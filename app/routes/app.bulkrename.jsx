// Bulk Rename — pattern renames across the file library with a full preview.
//
// Starter+ feature. The merchant picks a transform (find & replace, prefix,
// suffix, clean-up), previews every resulting filename, then applies. Videos
// are excluded (the Files API only allows alt/reference updates on them), and
// the extension is always preserved — the API requires it to match.
// Each applied rename is one metered operation; previews are free.
import { useState } from "react";
import { redirect, useLoaderData, useActionData, useNavigation, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getBillingStateCached } from "../billing.server";
import { entitled } from "../plans.server";
import { getRemaining, reserveFiles, refundFiles } from "../usage.server";
import { listFiles, renameFiles } from "../media.server";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Checkbox,
  Select,
  Box,
  Divider,
  Badge,
} from "@shopify/polaris";

async function requireRenameEntitlement(request) {
  const { admin, session } = await authenticate.admin(request);
  let plan = null;
  try {
    plan = (await getBillingStateCached(admin, session.shop)).plan;
  } catch (e) {
    if (e instanceof Response) throw e;
  }
  if (!entitled(plan, "rename")) throw redirect("/app/billing");
  return { admin, session, plan };
}

export const loader = async ({ request }) => {
  const { session, plan } = await requireRenameEntitlement(request);
  const remaining = await getRemaining(session.shop, plan).catch(() => 0);
  return { remaining };
};

const splitExt = (name) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""];
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9.-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

function transformName(filename, { mode, find, replace, prefix, suffix, clean }) {
  const [base, ext] = splitExt(filename);
  let next = base;
  if (mode === "findreplace" && find) next = next.split(find).join(replace || "");
  if (mode === "prefix" && prefix) next = `${prefix}${next}`;
  if (mode === "suffix" && suffix) next = `${next}${suffix}`;
  if (clean) next = slugify(next);
  next = next.trim();
  if (!next) return null; // never rename to an empty basename
  return `${next}${ext}`;
}

function readParams(form) {
  return {
    mode: String(form.get("mode") || "findreplace"),
    find: String(form.get("find") || ""),
    replace: String(form.get("replace") || ""),
    prefix: String(form.get("prefix") || ""),
    suffix: String(form.get("suffix") || ""),
    clean: form.get("clean") === "on" || form.get("clean") === "true",
  };
}

export const action = async ({ request }) => {
  const { admin, session, plan } = await requireRenameEntitlement(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "apply") {
    let pairs;
    try {
      pairs = JSON.parse(String(form.get("pairs") || "[]"));
    } catch {
      return { error: "Could not read the rename list — run the preview again." };
    }
    pairs = (Array.isArray(pairs) ? pairs : [])
      .filter((p) => p && p.id && p.filename)
      .map((p) => ({ id: String(p.id), filename: String(p.filename) }));
    if (!pairs.length) return { error: "Nothing to rename." };

    // Claim quota before the work, refund whatever fails.
    const res = await reserveFiles(session.shop, plan, pairs.length);
    if (!res.allowed) {
      return {
        error: `Renaming ${pairs.length} files needs more monthly operations than you have left (${res.remaining}). Deselect some files or upgrade your plan.`,
      };
    }
    const { renamed, errors } = await renameFiles(admin, pairs);
    const failedCount = pairs.length - renamed.length;
    if (failedCount > 0) await refundFiles(session.shop, failedCount);
    return { applied: renamed.length, applyErrors: errors };
  }

  // default: preview
  const params = readParams(form);
  if (params.mode === "findreplace" && !params.find && !params.clean) {
    return { error: "Enter text to find (or enable clean-up) to preview changes." };
  }
  const { files, truncated } = await listFiles(admin);
  const proposals = [];
  for (const f of files) {
    if (f.type === "video" || !f.filename) continue;
    const next = transformName(f.filename, params);
    if (next && next !== f.filename) {
      proposals.push({ id: f.id, from: f.filename, to: next });
    }
  }
  return { proposals, truncated, params };
};

export default function BulkRename() {
  const { remaining } = useLoaderData();
  const data = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const fmt = (n) => Number(n || 0).toLocaleString();

  const [mode, setMode] = useState("findreplace");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [clean, setClean] = useState(false);
  const [excluded, setExcluded] = useState({});

  const proposals = data?.proposals || [];
  const included = proposals.filter((p) => !excluded[p.id]);
  const pairs = included.map((p) => ({ id: p.id, filename: p.to }));

  return (
    <Page
      title="Bulk Rename"
      subtitle="Rename many files at once — with a preview of every change first."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Form method="post">
              <input type="hidden" name="intent" value="preview" />
              <BlockStack gap="300">
                <Select
                  label="Transform"
                  name="mode"
                  options={[
                    { label: "Find & replace", value: "findreplace" },
                    { label: "Add prefix", value: "prefix" },
                    { label: "Add suffix (before extension)", value: "suffix" },
                  ]}
                  value={mode}
                  onChange={setMode}
                />
                {mode === "findreplace" && (
                  <InlineStack gap="300">
                    <TextField label="Find" name="find" value={find} onChange={setFind} autoComplete="off" />
                    <TextField label="Replace with" name="replace" value={replace} onChange={setReplace} autoComplete="off" />
                  </InlineStack>
                )}
                {mode === "prefix" && (
                  <TextField label="Prefix" name="prefix" value={prefix} onChange={setPrefix} autoComplete="off" />
                )}
                {mode === "suffix" && (
                  <TextField label="Suffix" name="suffix" value={suffix} onChange={setSuffix} autoComplete="off" />
                )}
                <Checkbox
                  label="Clean up filenames (lowercase, spaces and underscores to dashes, strip special characters)"
                  name="clean"
                  checked={clean}
                  onChange={setClean}
                />
                <Text variant="bodySm" as="p" tone="subdued">
                  Extensions are always kept — only the name part changes. Videos can't be renamed
                  through the Files API and are skipped. Previews are free; each applied rename is
                  one operation ({fmt(remaining)} remaining this month).
                </Text>
                <InlineStack>
                  <Button variant="primary" submit loading={busy} disabled={busy}>
                    Preview changes
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>

        {data?.error && (
          <Layout.Section>
            <Banner tone="critical">{data.error}</Banner>
          </Layout.Section>
        )}

        {data?.applied != null && (
          <Layout.Section>
            <Banner tone={data.applyErrors?.length ? "warning" : "success"}>
              {`Renamed ${fmt(data.applied)} file${data.applied === 1 ? "" : "s"}.`}
              {data.applyErrors?.length ? ` Some failed: ${data.applyErrors.join("; ")}` : ""}
            </Banner>
          </Layout.Section>
        )}

        {data?.proposals && (
          <Layout.Section>
            <BlockStack gap="300">
              {data.truncated && (
                <Banner tone="warning">
                  Your library is larger than one pass covers — the preview is based on the newest files.
                </Banner>
              )}
              {proposals.length === 0 ? (
                <Card>
                  <Text as="p" tone="subdued">No filenames would change with these settings.</Text>
                </Card>
              ) : (
                <Card padding="0">
                  <Box padding="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingSm" as="h2">
                        {`${fmt(included.length)} of ${fmt(proposals.length)} renames selected`}
                      </Text>
                      <Form method="post">
                        <input type="hidden" name="intent" value="apply" />
                        <input type="hidden" name="pairs" value={JSON.stringify(pairs)} />
                        <Button
                          variant="primary"
                          submit
                          loading={busy}
                          disabled={busy || included.length === 0}
                        >
                          {`Apply ${fmt(included.length)} renames`}
                        </Button>
                      </Form>
                    </InlineStack>
                  </Box>
                  <Divider />
                  {proposals.map((p) => (
                    <Box key={p.id} padding="300">
                      <InlineStack gap="300" blockAlign="center" wrap={false}>
                        <Checkbox
                          label=""
                          labelHidden
                          checked={!excluded[p.id]}
                          onChange={(v) => setExcluded((s) => ({ ...s, [p.id]: !v }))}
                        />
                        <BlockStack gap="050">
                          <Text as="span" variant="bodySm" tone="subdued">{p.from}</Text>
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="info">→</Badge>
                            <Text as="span" variant="bodyMd">{p.to}</Text>
                          </InlineStack>
                        </BlockStack>
                      </InlineStack>
                    </Box>
                  ))}
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
