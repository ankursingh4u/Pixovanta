// Media library server helpers.
//
// Everything this app does runs through here: listing the store's files
// (Content > Files), content-hashing them to find exact duplicates, diffing
// files against product media to find unreferenced ones, bulk renaming, and
// deleting. All reads/writes go through the Admin GraphQL Files API; the only
// thing stored locally is a content-hash cache keyed by CDN url (see FileHash
// in prisma/schema.prisma).
import crypto from "node:crypto";
import db from "./db.server";

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

const FILES_QUERY = `#graphql
  query MediaLibraryFiles($first: Int!, $after: String, $query: String) {
    files(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        id
        alt
        createdAt
        fileStatus
        ... on MediaImage {
          mimeType
          image { url width height }
          originalSource { fileSize }
        }
        ... on GenericFile {
          mimeType
          url
          originalFileSize
        }
        ... on Video {
          filename
          originalSource { fileSize url }
          preview { image { url } }
        }
      }
    }
  }`;

// Media gids attached to products. Used to mark library files as "in use by a
// product"; files can also be used by themes/pages/blog posts, which this diff
// cannot see — the UI must present unreferenced files as "not used by any
// product", never as "safe to delete".
const PRODUCT_MEDIA_QUERY = `#graphql
  query ProductMediaIds($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        media(first: 250) { nodes { id } }
      }
    }
  }`;

const FILE_DELETE_MUTATION = `#graphql
  mutation MediaLibraryFileDelete($fileIds: [ID!]!) {
    fileDelete(fileIds: $fileIds) {
      deletedFileIds
      userErrors { field message code }
    }
  }`;

const FILE_RENAME_MUTATION = `#graphql
  mutation MediaLibraryFileRename($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id }
      userErrors { field message code }
    }
  }`;

// ---------------------------------------------------------------------------
// Files listing
// ---------------------------------------------------------------------------

const PAGE_SIZE = 250;
// Hard cap per listing walk so one pathological store can't pin the server.
export const MAX_FILES = 4000;

async function gql(admin, query, variables) {
  const resp = await admin.graphql(query, { variables });
  const json = await resp.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

const basename = (url) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split("/").pop() || "");
  } catch {
    return String(url).split("?")[0].split("/").pop() || "";
  }
};

// Normalize the three File subtypes into one shape the routes can render.
function normalizeNode(n) {
  const type =
    n.__typename === "MediaImage" ? "image" :
    n.__typename === "Video" ? "video" : "file";
  const url = n.image?.url || n.url || n.originalSource?.url || null;
  const previewUrl = n.image?.url || n.preview?.image?.url || null;
  return {
    id: n.id,
    type,
    url,
    previewUrl,
    filename: n.filename || basename(n.image?.url || n.url),
    bytes: n.originalSource?.fileSize ?? n.originalFileSize ?? null,
    width: n.image?.width ?? null,
    height: n.image?.height ?? null,
    alt: n.alt || "",
    createdAt: n.createdAt,
    status: n.fileStatus,
  };
}

// Walk the files connection. `query` takes the Files search syntax
// (e.g. "media_type:IMAGE"); `max` caps the walk.
export async function listFiles(admin, { query = null, max = MAX_FILES } = {}) {
  const out = [];
  let after = null;
  let truncated = false;
  for (;;) {
    const first = Math.min(PAGE_SIZE, max - out.length);
    if (first <= 0) { truncated = true; break; }
    const data = await gql(admin, FILES_QUERY, { first, after, query });
    const conn = data.files;
    out.push(...conn.nodes.map(normalizeNode));
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return { files: out, truncated };
}

// Set of media gids referenced by any product.
export async function getProductMediaIds(admin, { maxProducts = 5000 } = {}) {
  const ids = new Set();
  let after = null;
  let scanned = 0;
  let truncated = false;
  for (;;) {
    const first = Math.min(100, maxProducts - scanned);
    if (first <= 0) { truncated = true; break; }
    const data = await gql(admin, PRODUCT_MEDIA_QUERY, { first, after });
    const conn = data.products;
    for (const p of conn.nodes) {
      for (const m of p.media.nodes) ids.add(m.id);
    }
    scanned += conn.nodes.length;
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return { ids, truncated };
}

// ---------------------------------------------------------------------------
// Content hashing (duplicate detection)
// ---------------------------------------------------------------------------

// Shopify CDN urls carry a ?v=<version> that changes whenever the file's bytes
// change, so the url is a safe cache key: a cached hash can never describe
// different bytes than the ones it was computed from.
const DOWNLOAD_TIMEOUT_MS = 25_000;
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;

async function sha256FromUrl(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: ctl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const len = Number(resp.headers.get("content-length") || 0);
    if (len > MAX_DOWNLOAD_BYTES) throw new Error("too large to hash");
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error("too large to hash");
    return { hash: crypto.createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
  } finally {
    clearTimeout(t);
  }
}

// Hash a list of normalized files, using the FileHash cache where possible.
// Returns { byId: Map<fileId, {hash, bytes}>, fresh, failed, skipped } where
// `fresh` is the number of files that needed a download (what quota is charged
// for) and `skipped` is how many cache misses were left unhashed because
// `maxFresh` (the shop's remaining quota) ran out.
export async function hashFiles(files, { concurrency = 6, maxFresh = Infinity } = {}) {
  const hashable = files.filter((f) => f.url && f.type !== "video");
  const byId = new Map();
  const failedIds = [];

  // Cache lookups first — cached hashes are free.
  const urls = hashable.map((f) => f.url);
  const cached = urls.length
    ? await db.fileHash.findMany({ where: { url: { in: urls } } })
    : [];
  const cacheByUrl = new Map(cached.map((r) => [r.url, r]));
  let toFetch = [];
  for (const f of hashable) {
    const hit = cacheByUrl.get(f.url);
    if (hit) byId.set(f.id, { hash: hit.hash, bytes: hit.bytes });
    else toFetch.push(f);
  }
  let skipped = 0;
  if (Number.isFinite(maxFresh) && toFetch.length > maxFresh) {
    skipped = toFetch.length - Math.max(0, maxFresh);
    toFetch = toFetch.slice(0, Math.max(0, maxFresh));
  }

  // Simple worker pool over the misses.
  let i = 0;
  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= toFetch.length) return;
      const f = toFetch[idx];
      try {
        const { hash, bytes } = await sha256FromUrl(f.url);
        byId.set(f.id, { hash, bytes });
        await db.fileHash
          .upsert({
            where: { url: f.url },
            create: { url: f.url, hash, bytes },
            update: { hash, bytes },
          })
          .catch(() => {}); // cache write failure is not a scan failure
      } catch (err) {
        failedIds.push(f.id);
        console.error("[MEDIA] hash failed for %s: %s", f.url, err?.message || err);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  return {
    byId,
    fresh: toFetch.length - failedIds.length,
    failed: failedIds.length,
    skipped,
  };
}

// Group hashed files into duplicate sets (same bytes, 2+ files). Groups are
// sorted by wasted bytes descending; within a group the oldest file is first —
// the natural "keep" candidate.
export function groupDuplicates(files, hashesById) {
  const byHash = new Map();
  for (const f of files) {
    const h = hashesById.get(f.id);
    if (!h) continue;
    const list = byHash.get(h.hash) || [];
    list.push({ ...f, bytes: f.bytes ?? h.bytes });
    byHash.set(h.hash, list);
  }
  const groups = [];
  for (const [hash, list] of byHash) {
    if (list.length < 2) continue;
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const size = list[0].bytes ?? 0;
    groups.push({ hash, files: list, wastedBytes: size * (list.length - 1) });
  }
  groups.sort((a, b) => b.wastedBytes - a.wastedBytes);
  return groups;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// Delete files by gid. Returns { deleted: [ids], errors: [messages] }.
export async function deleteFiles(admin, fileIds) {
  const deleted = [];
  const errors = [];
  for (const ids of chunk(fileIds, 50)) {
    try {
      const data = await gql(admin, FILE_DELETE_MUTATION, { fileIds: ids });
      const res = data.fileDelete;
      deleted.push(...(res.deletedFileIds || []));
      for (const e of res.userErrors || []) errors.push(e.message);
    } catch (err) {
      errors.push(err?.message || String(err));
    }
  }
  return { deleted, errors };
}

// Rename files. `renames` is [{ id, filename }]. The new filename's extension
// must match the original (a Files API rule), so callers should preserve it.
export async function renameFiles(admin, renames) {
  const renamed = [];
  const errors = [];
  for (const batch of chunk(renames, 25)) {
    try {
      const data = await gql(admin, FILE_RENAME_MUTATION, {
        files: batch.map(({ id, filename }) => ({ id, filename })),
      });
      const res = data.fileUpdate;
      renamed.push(...(res.files || []).map((f) => f.id));
      for (const e of res.userErrors || []) errors.push(e.message);
    } catch (err) {
      errors.push(err?.message || String(err));
    }
  }
  return { renamed, errors };
}

