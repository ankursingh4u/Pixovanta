// Unused Files — images/videos in the library that no product references.
//
// Detection diffs the file library against every product's media. It cannot see
// theme, page, or blog usage (those reference files by URL, not by media id),
// so results are presented strictly as "not used by any product" with an
// explicit warning before deletion. Growth+ feature; scans are free (no
// downloads involved), deletes are free.
import { useState } from "react";
import { redirect, useActionData, useNavigation, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getBillingStateCached } from "../billing.server";
import { entitled } from "../plans.server";
import {
  listFiles,
  getProductMediaIds,
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
  Box,
  Divider,
} from "@shopify/polaris";

async function requireUnusedEntitlement(request) {
  const { admin, session } = await authenticate.admin(request);
  let plan = null;
  try {
    plan = (await getBillingStateCached(admin, session.shop)).plan;
  } catch (e) {
    if (e instanceof Response) throw e;
  }
  if (!entitled(plan, "unused")) throw redirect("/app/billing");
  return { admin, session };
}

export const loader = async ({ request }) => {
  await requireUnusedEntitlement(request);
  return {};
};

async function runScan(admin) {
  const [{ files, truncated }, { ids: usedIds, truncated: productsTruncated }] =
    await Promise.all([listFiles(admin), getProductMediaIds(admin)]);
  // Generic files (PDFs etc.) can never be product media, so "unused by any
  // product" is vacuously true and listing them would only invite accidental
  // deletion of files that themes or pages link to. Images and videos only.
  const unused = files
    .filter((f) => (f.type === "image" || f.type === "video") && !usedIds.has(f.id))
    .map((f) => ({
      id: f.id,
      filename: f.filename,
      bytes: f.bytes,
      createdAt: f.createdAt,
      previewUrl: thumb(f.previewUrl, 120),
      type: f.type,
    }));
  return {
    unused,
    checkedCount: files.length,
    totalBytes: unused.reduce((s, f) => s + (f.bytes || 0), 0),
    truncated: truncated || productsTruncated,
  };
}

export const action = async ({ request }) => {
  const { admin } = await requireUnusedEntitlement(request);
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    const ids = form.getAll("ids").filter(Boolean);
    if (!ids.length) return { error: "Nothing selected." };
    const { deleted, errors } = await deleteFiles(admin, ids);
    const scan = await runScan(admin);
    return { ...scan, deletedCount: deleted.length, deleteErrors: errors };
  }

  return await runScan(admin);
};

export default function UnusedFiles() {
  const data = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const [selected, setSelected] = useState({});
  const fmt = (n) => Number(n || 0).toLocaleString();

  const unused = data?.unused || [];
  const selectedIds = unused.filter((f) => selected[f.id]).map((f) => f.id);
  const allSelected = unused.length > 0 && selectedIds.length === unused.length;

  return (
    <Page
      title="Unused Files"
      subtitle="Images and videos in your library that no product references."
    >
      <Layout>
        <Layout.Section>
          <Banner tone="warning" title="Check before you delete">
            This report sees product usage only. A file can still be referenced by
            your theme, a page, a blog post, or a navigation image — deleting it
            breaks that reference permanently. Review anything you don't recognize
            in Content → Files first.
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p">
                The scan compares every file in your library against the media
                attached to every product. Scans are free and don't count against
                your monthly operations.
              </Text>
              <InlineStack>
                <Form method="post">
                  <input type="hidden" name="intent" value="scan" />
                  <Button variant="primary" submit loading={busy} disabled={busy}>
                    {data ? "Re-scan" : "Find unused files"}
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
              {data.truncated && (
                <Banner tone="warning">
                  Your library or catalog is larger than one scan covers — results
                  are based on the newest files and may be incomplete.
                </Banner>
              )}

              {unused.length === 0 ? (
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h2">Nothing unused</Text>
                    <Text as="p" tone="subdued">
                      {`Checked ${fmt(data.checkedCount)} files — every image and video is attached to a product.`}
                    </Text>
                  </BlockStack>
                </Card>
              ) : (
                <Card padding="0">
                  <Box padding="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h2">
                          {`${fmt(unused.length)} files not used by any product · ${formatBytes(data.totalBytes)}`}
                        </Text>
                        <Checkbox
                          label="Select all"
                          checked={allSelected}
                          onChange={(v) =>
                            setSelected(v ? Object.fromEntries(unused.map((f) => [f.id, true])) : {})
                          }
                        />
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
                  </Box>
                  <Divider />
                  {unused.map((f) => (
                    <Box key={f.id} padding="300">
                      <InlineStack gap="300" blockAlign="center" wrap={false}>
                        <Checkbox
                          label=""
                          labelHidden
                          checked={Boolean(selected[f.id])}
                          onChange={(v) => setSelected((s) => ({ ...s, [f.id]: v }))}
                        />
                        {f.previewUrl ? (
                          <Thumbnail source={f.previewUrl} alt={f.filename} size="small" />
                        ) : (
                          <Box minWidth="40px" />
                        )}
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd">{f.filename || f.id}</Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {`${f.type} · ${formatBytes(f.bytes)} · added ${new Date(f.createdAt).toLocaleDateString()}`}
                          </Text>
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
