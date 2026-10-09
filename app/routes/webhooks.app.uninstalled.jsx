// app/uninstalled + the three mandatory GDPR compliance topics.
//
// shopify.app.toml points `app/uninstalled` AND the compliance topics
// (`customers/redact`, `customers/data_request`, `shop/redact`) at this one
// URI, so this handler MUST branch on the topic. It used to delete the shop's
// sessions for whatever arrived — which meant a customer-redaction request,
// something Shopify can send at any time for a live shop, logged the merchant
// out and broke their installation until they reinstalled.
//
// What this app actually stores per shop (see prisma/schema.prisma):
//   Session       credentials + the staff user's name/email/locale
//   ShopSettings  the autoOptimize toggle
//   UsageCounter  monthly image counters
//   ImageSize     measured byte size of a Shopify CDN image url
//
// None of it is customer data: the app holds `write_products,write_files` and
// never reads customers, orders or checkouts. That is why the customers/* topics
// have nothing to erase and nothing to report.
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Erase every row this app holds for a shop.
//
// ImageSize is keyed by CDN url rather than by shop, so it cannot be filtered by
// shop and is deliberately left alone: a url carries no identity beyond "some
// image was this many bytes", and the rows are unreachable once the shop's
// products are gone (a changed file gets a new ?v= url, so a stale row is never
// read again).
async function purgeShop(shop) {
  const results = await Promise.allSettled([
    db.session.deleteMany({ where: { shop } }),
    db.shopSettings.deleteMany({ where: { shop } }),
    db.usageCounter.deleteMany({ where: { shop } }),
  ]);
  // Report per-table outcomes instead of throwing: a 5xx makes Shopify retry the
  // whole webhook, which would re-run the deletes that already succeeded.
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const table = ["session", "shopSettings", "usageCounter"][i];
      console.error(`[PURGE] ${shop} ${table} failed:`, r.reason?.message || r.reason);
    }
  });
}

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    // The merchant removed the app. Credentials are now useless, so drop them
    // along with the per-shop settings and counters.
    case "APP_UNINSTALLED":
      if (session) await purgeShop(shop);
      break;

    // Shop-level erasure request (sent 48h after an uninstall, and on demand).
    // Unconditional — by this point there is no session left to gate on.
    case "SHOP_REDACT":
      await purgeShop(shop);
      break;

    // We store no customer data, so there is nothing to erase and nothing to
    // hand back. Acknowledging is the correct, complete response.
    case "CUSTOMERS_REDACT":
    case "CUSTOMERS_DATA_REQUEST":
      console.log(`[COMPLIANCE] ${topic} for ${shop}: no customer data is stored by this app`);
      break;

    default:
      console.log(`[WEBHOOK] Unhandled topic ${topic} for ${shop}`);
  }

  return new Response();
};
