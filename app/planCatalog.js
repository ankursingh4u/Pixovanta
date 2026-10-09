// Client-safe pricing display catalog (marketing copy + prices) for the pricing
// page and pricing wall. The source of truth for runtime gating/quotas is
// plans.server.js — keep the prices/quotas here in sync with that file and with
// the plans created in the Partner Dashboard.
//
// Note: because this is a Managed Pricing app, every "Choose plan" button sends
// the merchant to Shopify's hosted pricing page where they pick the real plan —
// the per-tier buttons here are purely informational about what they'll get.
//
// EVERY BULLET BELOW MUST BE SOMETHING THE APP DOES TODAY. This list used to
// advertise restore-originals, SEO filenames, resize & crop, scheduled runs,
// watermarking, HEIC, bulk export and priority processing — none of which are
// built. Keep it in step with FEATURES in plans.server.js; a bullet here that
// a subscriber cannot find in the app is a broken promise and an App Store
// listing-accuracy rejection.
export const PLAN_TIERS = [
  {
    name: "Free",
    price: 0,
    priceAnnual: 0,
    images: "100",
    tagline: "Try it out",
    features: [
      "100 images / month",
      "Image compression & WebP conversion",
      "Measured before and after sizes",
      "Optimization analytics & CSV export",
    ],
  },
  {
    name: "Starter",
    price: 19,
    priceAnnual: 190,
    images: "2,000",
    tagline: "For growing stores",
    features: [
      "2,000 images / month",
      "Everything in Free",
      "AI alt text generation",
      "Bulk-apply alt text across a product",
    ],
  },
  {
    name: "Growth",
    price: 49,
    priceAnnual: 490,
    images: "15,000",
    tagline: "Most popular",
    popular: true,
    features: [
      "15,000 images / month",
      "Everything in Starter",
      "Auto-optimize new products",
      "Page Speed reports",
    ],
  },
  {
    name: "Pro",
    price: 499,
    priceAnnual: 2499,
    images: "50,000",
    tagline: "High volume",
    features: [
      "50,000 images / month",
      "Everything in Growth",
    ],
  },
];
