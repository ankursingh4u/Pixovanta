// Duplicate Finder — content-hash scan over the file library + bulk cleanup.
//
// Scanning downloads each not-yet-hashed file once, SHA-256s it, and caches the
// hash by CDN url (see FileHash), so re-scans only pay for files that changed.
// Fresh hashes are the metered operation; cache hits and deletes are free.
import { useState } from "react";
import { useLoaderData, useActionData, useNavigation, Form, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getBillingStateCached } from "../billing.server";
import { getRemaining, incrementUsage } from "../usage.server";
import {
  listFiles,
  hashFiles,
  groupDuplicates,
  deleteFiles,
} from "../media.server";
import { formatBytes, thumb } from "../format";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Checkbox,
  Thumbnail,
  Badge,
  Box,
  Divider,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  let plan = null;
  try {
    plan = (await getBillingStateCached(admin, session.shop)).plan;
  } catch (e) {
    if (e instanceof Response) throw e;
  }
  const remaining = await getRemaining(session.shop, plan).catch(() => 0);
  return { remaining };
};

// Scan (optionally after deleting a batch first). Delete + rescan is one
// action so the merchant always looks at a list that reflects the library.
async function runScan(admin, shop, plan) {
  const { files, truncated } = await listFiles(admin);
  const remaining = await getRemaining(shop, plan);
  const { byId, fresh, failed, skipped } = await hashFiles(files, { maxFresh: remaining });
  if (fresh > 0) await incrementUsage(shop, fresh);
  const groups = groupDuplicates(files, byId).map((g) => ({
    hash: g.hash,
    wastedBytes: g.wastedBytes,
    files: g.files.map((f) => ({
      id: f.id,
      filename: f.filename,
      bytes: f.bytes,
      createdAt: f.createdAt,
      previewUrl: thumb(f.previewUrl, 120),
      type: f.type,
    })),
  }));
  return {
    groups,
    scanned: byId.size,
    fresh,
    failed,
    skipped,
    truncated,
    totalWasted: groups.reduce((s, g) => s + g.wastedBytes, 0),
  };
}

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  let plan = null;
  try {
    plan = (await getBillingStateCached(admin, session.shop)).plan;
  } catch (e) {
    if (e instanceof Response) throw e;
  }

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    const ids = form.getAll("ids").filter(Boolean);
    if (!ids.length) return { error: "Nothing selected." };
    const { deleted, errors } = await deleteFiles(admin, ids);
    const scan = await runScan(admin, session.shop, plan);
    return { ...scan, deletedCount: deleted.length, deleteErrors: errors };
  }

  // default: scan
  return await runScan(admin, session.shop, plan);
};

export default function DuplicateFinder() {
  const { remaining } = useLoaderData();
  const data = useActionData();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const busy = navigation.state === "submitting";

  // Selected-for-deletion ids. Seeded per group render: everything but the
  // oldest copy starts checked, since that's the overwhelmingly common intent.
  const [deselected, setDeselected] = useState({}); // id -> true (user unchecked)
  const [extraSelected, setExtraSelected] = useState({}); // id -> true (user checked a keeper)

  const groups = data?.groups || [];
  const isSelected = (file, idx) =>
    idx === 0 ? Boolean(extraSelected[file.id]) : !deselected[file.id];
  const toggle = (file, idx) => {
    if (idx === 0) setExtraSelected((s) => ({ ...s, [file.id]: !s[file.id] }));
    else setDeselected((s) => ({ ...s, [file.id]: !s[file.id] }));
  };
  const selectedIds = groups.flatMap((g) =>
    g.files.filter((f, i) => isSelected(f, i)).map((f) => f.id),
  );

  const fmt = (n) => Number(n || 0).toLocaleString();

  return (
    <Page
      title="Duplicate Finder"
      subtitle="Find files with byte-identical content and clean up the copies."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p">
                Scanning hashes each file's actual content, so renamed copies and
                re-uploads are caught even when the filenames differ. Files already
                scanned are cached and free to re-scan; only new or changed files
                count against your monthly operations ({fmt(remaining)} remaining).
              </Text>
              <InlineStack gap="300">
                <Form method="post">
                  <input type="hidden" name="intent" value="scan" />
                  <Button variant="primary" submit loading={busy} disabled={busy}>
                    {data ? "Re-scan library" : "Scan library"}
                  </Button>
                </Form>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {data?.error && (
          <Layout.Section>
            <Banner tone="critical">{data.error}</Banner>
          </Layout.Section>
        )}

        {data?.deletedCount != null && (
          <Layout.Section>
            <Banner tone={data.deleteErrors?.length ? "warning" : "success"}>
              {`Deleted ${fmt(data.deletedCount)} file${data.deletedCount === 1 ? "" : "s"}.`}
              {data.deleteErrors?.length
                ? ` ${data.deleteErrors.length} failed: ${data.deleteErrors.join("; ")}`
                : ""}
            </Banner>
          </Layout.Section>
        )}

        {data && !data.error && (
          <Layout.Section>
            <BlockStack gap="300">
              {(data.skipped > 0 || data.failed > 0 || data.truncated) && (
                <Banner tone="warning">
                  {data.skipped > 0 &&
                    `${fmt(data.skipped)} files were not scanned because your monthly operations ran out — upgrade or re-scan next month. `}
                  {data.failed > 0 && `${fmt(data.failed)} files could not be downloaded for hashing. `}
                  {data.truncated && "The library is larger than one scan covers; the newest files were scanned."}
                </Banner>
              )}

              {groups.length === 0 ? (
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h2">No duplicates found</Text>
                    <Text as="p" tone="subdued">
                      {`Scanned ${fmt(data.scanned)} files — every one has unique content.`}
                    </Text>
                  </BlockStack>
                </Card>
              ) : (
                <>
                  <Card>
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h2">
                          {`${fmt(groups.length)} duplicate group${groups.length === 1 ? "" : "s"} · ${formatBytes(data.totalWasted)} wasted`}
                        </Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          In each group the oldest copy is kept by default. Deleting a file removes it
                          from Shopify permanently — anything still linking to its URL will break.
                        </Text>
                      </BlockStack>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        {selectedIds.map((id) => (
                          <input key={id} type="hidden" name="ids" value={id} />
                        ))}
                        <Button
                          variant="primary"
                          tone="critical"
                          submit
                          disabled={busy || selectedIds.length === 0}
                          loading={busy}
                        >
                          {`Delete ${fmt(selectedIds.length)} selected`}
                        </Button>
                      </Form>
                    </InlineStack>
                  </Card>

                  {groups.map((g) => (
                    <Card key={g.hash} padding="0">
                      <Box padding="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingSm" as="h3">
                            {`${g.files.length} identical files`}
                          </Text>
                          <Badge tone="attention">{`${formatBytes(g.wastedBytes)} wasted`}</Badge>
                        </InlineStack>
                      </Box>
                      <Divider />
                      {g.files.map((f, idx) => (
                        <Box key={f.id} padding="300">
                          <InlineStack gap="300" blockAlign="center" wrap={false}>
                            <Checkbox
                              label=""
                              labelHidden
                              checked={isSelected(f, idx)}
                              onChange={() => toggle(f, idx)}
                            />
                            {f.previewUrl ? (
                              <Thumbnail source={f.previewUrl} alt={f.filename} size="small" />
                            ) : (
                              <Box minWidth="40px" />
                            )}
                            <BlockStack gap="050">
                              <InlineStack gap="200" blockAlign="center">
                                <Text as="span" variant="bodyMd">{f.filename || f.id}</Text>
                                {idx === 0 && <Badge tone="success">Oldest — kept</Badge>}
                              </InlineStack>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {`${formatBytes(f.bytes)} · added ${new Date(f.createdAt).toLocaleDateString()}`}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      ))}
                    </Card>
                  ))}
                </>
              )}
            </BlockStack>
          </Layout.Section>
        )}

        {!data && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h2">How it works</Text>
                <Text as="p" tone="subdued">
                  1. Scan downloads each file once and fingerprints its content (SHA-256).
                  2. Files with byte-identical content are grouped, newest copies pre-selected.
                  3. You review each group and delete the copies you don't need.
                </Text>
                <InlineStack>
                  <Button variant="plain" onClick={() => navigate("/app/billing")}>
                    See plan limits
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
