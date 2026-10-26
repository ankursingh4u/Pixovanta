// Plan tier catalog + resolution.
//
// This app is a Shopify "Managed Pricing" app: the actual plans (and their real
// prices/trials) are created in the Partner Dashboard, and a merchant subscribes
// to one on Shopify's hosted pricing page. The app cannot create charges; its job
// is to read the *name* of the merchant's active subscription and map it to the
// tier defined here — which decides the monthly file-operation quota and which features
// are unlocked.
//
// IMPORTANT: the plan names below (and their "<name> Annual" variants) MUST match
// the plan names created in the Partner Dashboard exactly, because tier resolution
// is by name. `getPlanByName` normalizes case and a trailing " Annual" and falls
// back to the Free tier for unknown / missing names.

// Feature flags used for gating.
//
// Only flags backed by shipped functionality belong here — the billing page
// renders every truthy flag as a line under "Included in your plan", and
// planCatalog.js sells them on the pricing page, so an unshipped flag is a
// broken promise and an App Store listing-accuracy rejection. Add one when the
// UI lands, not before.
export const FEATURES = [
  "duplicates", // duplicate finder (content-hash scan + cleanup)
  "rename",     // bulk rename
  "unused",     // files not used by any product + bulk cleanup
];

function feat(...enabled) {
  const set = new Set(enabled);
  return Object.fromEntries(FEATURES.map((f) => [f, set.has(f)]));
}

// Tier catalog, cheapest → most expensive. `tier` is the stable internal key;
// `name` is the human/Partner-Dashboard plan name used for resolution.
// `monthlyFiles` meters billable file operations: fresh duplicate-scan hashes
// (cache hits are free) and bulk renames. Deletes are never metered.
export const PLANS = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    priceAnnual: 0,
    monthlyFiles: 200,
    features: feat("duplicates"),
  },
  {
    tier: "starter",
    name: "Starter",
    price: 19,
    priceAnnual: 190,
    monthlyFiles: 2000,
    features: feat("duplicates", "rename"),
  },
  {
    tier: "growth",
    name: "Growth",
    price: 49,
    priceAnnual: 490,
    monthlyFiles: 15000,
    features: feat("duplicates", "rename", "unused"),
  },
  {
    tier: "pro",
    name: "Pro",
    price: 499,
    priceAnnual: 2499,
    monthlyFiles: 50000,
    // Same capabilities as Growth; Pro is purely a higher monthly quota.
    features: feat("duplicates", "rename", "unused"),
  },
];

export const FREE_PLAN = PLANS[0];

// Resolve a Shopify subscription name to a tier. Strips a trailing " Annual"
// (so "Growth Annual" → "Growth") and matches case-insensitively. Falls back to
// the Free tier when the name is missing or unrecognized — so an installed-but-
// not-yet-subscribed shop still has a usable (limited) plan.
export function getPlanByName(name) {
  if (!name) return FREE_PLAN;
  const base = String(name).replace(/\s+annual$/i, "").trim().toLowerCase();
  return PLANS.find((p) => p.name.toLowerCase() === base) || FREE_PLAN;
}

// Boolean feature gate. Safe with a null/undefined plan (treated as Free).
export function entitled(plan, feature) {
  const p = plan || FREE_PLAN;
  return Boolean(p.features?.[feature]);
}
