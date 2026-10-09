// Secondary "resources" page. Not in the nav menu — reachable by direct link,
// kept as the place to hang help content without touching the primary surfaces.
export default function AdditionalPage() {
  return (
    <s-page heading="Pixovanta resources">
      <s-section heading="How Pixovanta works">
        <s-paragraph>
          Pixovanta re-encodes your product images to WebP, replaces the originals
          on the product, and records the measured before/after file sizes on the
          product itself — so the savings you see are real bytes, not estimates.
        </s-paragraph>
        <s-paragraph>
          Start on <s-link href="/app/productoptimization">Image Optimization</s-link> to
          run the optimizer, then check{" "}
          <s-link href="/app/imageoptimizationdashboard">Analytics</s-link> for
          measured savings by format and your top optimized pages.
        </s-paragraph>
      </s-section>
      <s-section slot="aside" heading="Resources">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/billing">Plan &amp; billing</s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://web.dev/articles/optimize-lcp"
              target="_blank"
            >
              Optimizing Largest Contentful Paint
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav"
              target="_blank"
            >
              App nav best practices
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
