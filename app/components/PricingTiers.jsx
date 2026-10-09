import { PLAN_TIERS } from "../planCatalog";

// 4-tier pricing comparison used by both the standalone pricing page and the
// in-app pricing wall. Presentational only: every plan CTA is a real top-frame
// link (`target="_top"`) to Shopify's hosted managed-pricing page, where the
// actual price/cycle live and are picked. A direct anchor is used (rather than a
// form POST + reauthorize-header redirect) because a user click is a reliable
// user-activation that can navigate the top frame out of the embedded iframe —
// the POST-based redirect intermittently failed during initial setup and looped
// the merchant back to the app index.
//
// NOTE: we intentionally do NOT show prices here. Prices are owned by the
// Partner Dashboard plans and can be changed there without a code deploy;
// rendering them in-app would risk showing a stale amount. The merchant sees the
// real price on Shopify's pricing page after clicking through.
export default function PricingTiers({ pricingUrl }) {
  return (
    <div style={s.page}>
      <div style={s.head}>
        <p style={s.appLabel}>[ PIXOVANTA ]</p>
        <h1 style={s.heading}>Pricing that scales with you.</h1>
        <p style={s.subheading}>
          Optimize images, boost speed, and rank higher — pick the plan that fits your catalog.
        </p>
      </div>

      <div style={s.grid}>
        {PLAN_TIERS.map((tier) => (
          <div key={tier.name} style={tier.popular ? s.cardPopular : s.card}>
            {/* Cap bar across the top of every card; the popular tier gets the
                full gradient, the rest a muted hairline. */}
            <div style={tier.popular ? s.capPopular : s.cap} />
            {tier.popular && <div style={s.ribbon}>MOST POPULAR</div>}

            <div style={s.cardBody}>
              <p style={s.tierName}>{tier.name}</p>
              <p style={s.tierTagline}>{tier.tagline}</p>

              <div style={s.quotaRow}>
                <span style={s.quotaValue}>{tier.images}</span>
                <span style={s.quotaUnit}>images / month</span>
              </div>

              <a
                href={pricingUrl}
                target="_top"
                style={{
                  ...(tier.popular ? s.ctaPrimary : s.ctaSecondary),
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                {tier.price === 0 ? "Start free" : "Choose plan"}
              </a>

              <div style={s.featureList}>
                {tier.features.map((f, i) => (
                  <div key={i} style={s.featureRow}>
                    <span style={s.check}>▸</span>
                    <span style={s.featureText}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={s.disclaimer}>Secure billing through Shopify · Cancel anytime</p>
    </div>
  );
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const s = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #F0FBFA 0%, #DEF5F2 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  head: { display: "flex", flexDirection: "column", alignItems: "center" },
  appLabel: {
    fontFamily: MONO,
    fontSize: 11, fontWeight: 700, letterSpacing: "0.22em",
    color: "#0B6B63", margin: "0 0 16px 0", textTransform: "uppercase",
  },
  heading: {
    fontSize: 40, fontWeight: 800, color: "#0A1F2C",
    margin: "0 0 10px 0", textAlign: "center", letterSpacing: "-0.5px", lineHeight: 1.1,
  },
  subheading: {
    fontSize: 15, color: "#52646E", margin: "0 0 32px 0",
    textAlign: "center", maxWidth: 560,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 18,
    width: "100%",
    maxWidth: 1080,
    alignItems: "start",
  },
  card: {
    position: "relative",
    background: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 6px 22px -12px rgba(10,31,44,0.22)",
    border: "1px solid #D4E8E5",
  },
  cardPopular: {
    position: "relative",
    background: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 22px 46px -22px rgba(6,78,75,0.55)",
    border: "2px solid #0D9488",
    transform: "translateY(-6px)",
  },
  cap: { height: 3, background: "#D4E8E5" },
  capPopular: { height: 4, background: "linear-gradient(90deg, #0D9488 0%, #22D3C5 100%)" },
  ribbon: {
    position: "absolute", top: 12, right: 0,
    background: "linear-gradient(135deg, #0D9488 0%, #22D3C5 100%)", color: "#FFFFFF",
    fontFamily: MONO,
    fontSize: 9, fontWeight: 800,
    letterSpacing: "0.10em", padding: "4px 10px 4px 12px",
    borderRadius: "4px 0 0 4px", whiteSpace: "nowrap",
    boxShadow: "0 4px 12px -4px rgba(6,78,75,0.55)",
  },
  cardBody: { padding: "24px 22px 26px" },
  tierName: { fontSize: 18, fontWeight: 800, color: "#0A1F2C", margin: "0 0 2px 0" },
  tierTagline: { fontSize: 12, color: "#7A8C93", margin: "0 0 18px 0" },
  quotaRow: {
    display: "flex", alignItems: "baseline", gap: 7,
    paddingBottom: 16, marginBottom: 18, borderBottom: "1px solid #E6F2F0",
  },
  quotaValue: {
    fontFamily: MONO, fontSize: 26, fontWeight: 700,
    color: "#0B6B63", letterSpacing: "-0.02em", lineHeight: 1,
  },
  quotaUnit: { fontSize: 12, color: "#7A8C93" },
  ctaPrimary: {
    width: "100%", padding: "11px", background: "linear-gradient(135deg, #0D9488 0%, #22D3C5 100%)", color: "#FFFFFF",
    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 20,
    boxShadow: "0 8px 18px -8px rgba(13,148,136,0.60)",
  },
  ctaSecondary: {
    width: "100%", padding: "11px", background: "#F0FBFA", color: "#0B6B63",
    border: "1px solid #B7E4DE", borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 20,
  },
  featureList: { display: "flex", flexDirection: "column", gap: 9 },
  featureRow: { display: "flex", alignItems: "flex-start", gap: 8 },
  check: { color: "#0D9488", fontWeight: 800, fontSize: 11, lineHeight: "18px", flexShrink: 0 },
  featureText: { fontSize: 13, color: "#36474F", lineHeight: "18px" },
  disclaimer: { textAlign: "center", fontSize: 12, color: "#7A8C93", marginTop: 34 },
};
