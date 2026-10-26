// Client-safe formatting helpers shared by server code and route components.
// Keep this module free of server-only imports — route components import it,
// so anything here ships to the browser.

export function formatBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Shopify CDN images accept size params — cheap thumbnails with no proxying.
export function thumb(url, px = 120) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(px));
    u.searchParams.set("height", String(px));
    return u.toString();
  } catch {
    return url;
  }
}
