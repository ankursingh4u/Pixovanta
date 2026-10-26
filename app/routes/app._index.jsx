import { useNavigate, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getBillingStateCached } from "../billing.server";
import { getUsage } from "../usage.server";
import { entitled } from "../plans.server";
import { listFiles } from "../media.server";
import { formatBytes } from "../format";
import {
  Page,
  Layout,
  Card,
  Button,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Box,
  ProgressBar,
  Divider,
} from "@shopify/polaris";

// The home snapshot walks at most this many files — enough for an accurate
// picture on most stores without pinning the loader on a huge library.
const SNAPSHOT_MAX = 1000;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  let plan = null;
  try {
    plan = (await getBillingStateCached(admin, session.shop)).plan;
  } catch (e) {
    if (e instanceof Response) throw e; // let re-auth propagate
  }

  let usage = { filesUsed: 0 };
  try {
    usage = await getUsage(session.shop);
  } catch { /* usage table not ready — defaults */ }

  // Library snapshot: counts, storage, largest files. Failure here must not
  // take down the home page — render the dashboards with placeholders instead.
  let snapshot = null;
  try {
    const { files, truncated } = await listFiles(admin, { max: SNAPSHOT_MAX });
    const byType = { image: 0, video: 0, file: 0 };
    let totalBytes = 0;
    for (const f of files) {
      byType[f.type] = (byType[f.type] || 0) + 1;
      totalBytes += f.bytes || 0;
    }
    const largest = [...files]
      .filter((f) => f.bytes != null)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5)
      .map((f) => ({ id: f.id, filename: f.filename, bytes: f.bytes, type: f.type }));
    snapshot = { count: files.length, truncated, byType, totalBytes, largest };
  } catch (e) {
    console.error("[HOME] library snapshot failed:", e?.message || e);
  }

  return {
    plan: {
      name: plan?.name || "Free",
      tier: plan?.tier || "free",
      monthlyFiles: plan?.monthlyFiles ?? 200,
      rename: entitled(plan, "rename"),
      unused: entitled(plan, "unused"),
    },
    usage,
    snapshot,
  };
};

export default function Index() {
  const navigate = useNavigate();
  const { plan, usage, snapshot } = useLoaderData();

  const quota = plan.monthlyFiles || 0;
  const used = usage?.filesUsed || 0;
  const remaining = Math.max(0, quota - used);
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const fmt = (n) => Number(n).toLocaleString();

  // Tool rows — a horizontal list with a ringed glyph and a monospace index,
  // so the set reads as a numbered workflow rather than a card grid.
  const tools = [
    {
      icon: "⧉",
      title: "Duplicate Finder",
      desc: "Scan your file library for exact duplicates by content, see the wasted storage, and clean up copies in bulk while keeping the original.",
      cta: "Find duplicates",
      onClick: () => navigate("/app/duplicatefinder"),
      available: true,
    },
    {
      icon: "◌",
      title: "Unused Files",
      desc: "List files that no product references — old banners, replaced images, abandoned uploads — and remove them in bulk.",
      cta: plan.unused ? "Review unused files" : "Upgrade to Growth",
      onClick: () => navigate(plan.unused ? "/app/unusedfiles" : "/app/billing"),
      available: plan.unused,
      badge: plan.unused ? undefined : { label: "Growth & up", tone: "attention" },
    },
    {
      icon: "✎",
      title: "Bulk Rename",
      desc: "Find & replace, prefix or suffix across many filenames at once, with a preview of every change before it's applied.",
      cta: plan.rename ? "Rename files" : "Upgrade to Starter",
      onClick: () => navigate(plan.rename ? "/app/bulkrename" : "/app/billing"),
      available: plan.rename,
      badge: plan.rename ? undefined : { label: "Starter & up", tone: "attention" },
    },
  ];

  const counted = snapshot
    ? `${fmt(snapshot.count)}${snapshot.truncated ? "+" : ""}`
    : "—";

  // Numeric stats get the big tabular figure; word values get a tag so long
  // labels can't wrap into an overlapping headline.
  const stats = [
    { label: "Current plan", value: plan.name, tag: "brand" },
    { label: "Files in library", value: counted },
    { label: "Storage (newest files)", value: snapshot ? formatBytes(snapshot.totalBytes) : "—" },
    { label: "Operations left", value: fmt(remaining) },
  ];

  return (
    <Page>
      {/* Hero */}
      <div className="pv-hero">
        <InlineStack align="space-between" blockAlign="center" wrap={false} gap="600">
          <BlockStack gap="300">
            <span className="pv-hero-eyebrow">Pixovanta</span>
            <div className="pv-hero-copy">
              <h1>A tidy file library, kept tidy.</h1>
              <p>See what's in your store's files, find duplicates and dead weight, and rename in bulk — without touching a single product page.</p>
            </div>
          </BlockStack>
          <Button variant="primary" size="large" onClick={() => navigate("/app/duplicatefinder")}>
            Scan for duplicates
          </Button>
        </InlineStack>
      </div>

      <Layout>
        {/* Dashboard stat cards */}
        <Layout.Section>
          <div className="pv-stats">
            {stats.map((s) => (
              <div key={s.label} className="pv-stat">
                {s.tag ? (
                  <span className={`pv-stat-tag pv-stat-tag--${s.tag}`} title={s.value}>
                    {s.value}
                  </span>
                ) : (
                  <p className="pv-stat-value">{s.value}</p>
                )}
                <p className="pv-stat-label">{s.label}</p>
              </div>
            ))}
          </div>
        </Layout.Section>

        {/* Monthly usage */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingSm" as="h2">Monthly file operations</Text>
                  <Badge tone={plan.tier === "free" ? undefined : "success"}>{`${plan.name} plan`}</Badge>
                </InlineStack>
                <Button variant="plain" onClick={() => navigate("/app/billing")}>Manage plan</Button>
              </InlineStack>
              <ProgressBar progress={pct} size="small" tone={pct >= 100 ? "critical" : "primary"} />
              <Text variant="bodySm" as="p" tone="subdued">
                {`${fmt(used)} of ${fmt(quota)} operations this month · ${fmt(remaining)} remaining. Scanning a new file or renaming one counts as one operation; deletes and re-scans of unchanged files are free.`}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Library breakdown */}
        {snapshot && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">
                  {snapshot.truncated
                    ? `Library snapshot (newest ${fmt(snapshot.count)} files)`
                    : "Library snapshot"}
                </Text>
                <InlineStack gap="400">
                  <Badge>{`${fmt(snapshot.byType.image)} images`}</Badge>
                  <Badge>{`${fmt(snapshot.byType.video)} videos`}</Badge>
                  <Badge>{`${fmt(snapshot.byType.file)} other files`}</Badge>
                </InlineStack>
                {snapshot.largest.length > 0 && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" as="p" tone="subdued">Largest files</Text>
                    {snapshot.largest.map((f) => (
                      <InlineStack key={f.id} align="space-between" blockAlign="center">
                        <Text variant="bodySm" as="span" truncate>{f.filename || f.id}</Text>
                        <Text variant="bodySm" as="span" tone="subdued">{formatBytes(f.bytes)}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Tools — numbered horizontal rows */}
        <Layout.Section>
          <BlockStack gap="300">
            <p className="pv-eyebrow">Your toolkit</p>
            <Card padding="0">
              <BlockStack gap="0">
                {tools.map((t, i) => (
                  <div key={t.title}>
                    {i > 0 && <Divider />}
                    <div className="pv-tool">
                      <Box padding="400">
                        <InlineStack align="space-between" blockAlign="center" wrap={false} gap="400">
                          <InlineStack gap="300" blockAlign="center" wrap={false}>
                            <span className="pv-tool-index">{String(i + 1).padStart(2, "0")}</span>
                            <div className="pv-tool-icon">{t.icon}</div>
                            <BlockStack gap="100">
                              <InlineStack gap="200" blockAlign="center">
                                <Text variant="headingSm" as="h3">{t.title}</Text>
                                {t.badge && <Badge tone={t.badge.tone}>{t.badge.label}</Badge>}
                              </InlineStack>
                              <Text variant="bodySm" as="p" tone="subdued">{t.desc}</Text>
                            </BlockStack>
                          </InlineStack>
                          <Box minWidth="160px">
                            <Button
                              variant={t.available ? "primary" : "secondary"}
                              onClick={t.onClick}
                              fullWidth
                            >
                              {t.cta}
                            </Button>
                          </Box>
                        </InlineStack>
                      </Box>
                    </div>
                  </div>
                ))}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
