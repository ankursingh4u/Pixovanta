import { useEffect } from "react";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { authenticate, sessionStorage } from "../shopify.server";
import { getBillingStateCached } from "../billing.server";
import { entitled } from "../plans.server";

import "@shopify/polaris/build/esm/styles.css";

import enTranslations from "@shopify/polaris/locales/en.json";

function isExpiredToken(e) {
  return e?.response?.networkStatusCode === 403 || String(e?.message).includes('Forbidden');
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // No subscription is NOT a locked door.
  //
  // This used to render a full-page pricing wall whenever hasActivePlan was
  // false — no nav, no routes, nothing. That contradicted getBillingState,
  // which deliberately falls back to FREE_PLAN "so an installed shop is always
  // usable", and it carried a real lockout risk: Shopify does not reliably
  // create an AppSubscription for a $0 managed-pricing plan, so a merchant who
  // picked Free could come back to the same wall forever, as could an App Store
  // reviewer who never subscribes.
  //
  // Entitlements are already enforced per feature — the nav hides what a plan
  // does not include, each gated loader redirects, and each gated action
  // refuses — so the wall was never what protected paid features. Free now gets
  // the app it is entitled to (compression, WebP, analytics) and upgrade paths
  // live on the home page and Billing.
  let features = { pageSpeed: false, altText: false };
  try {
    // Cached per-shop (positive results only) so paying merchants don't pay a
    // Shopify roundtrip on every click; a fresh subscribe still unlocks
    // instantly since negatives aren't cached.
    const state = await getBillingStateCached(admin, session.shop);
    // Entitlement booleans drive which nav items render (Page Speed, Alt Text).
    features = {
      pageSpeed: entitled(state.plan, "pageSpeed"),
      altText: entitled(state.plan, "altText"),
    };
  } catch (e) {
    // Propagate redirect Responses (e.g. OAuth flow initiated by the library),
    // but treat 4xx Responses as an expired/revoked token — trigger re-auth
    // instead of letting a raw 403 reach the browser and crash React hydration.
    if (e instanceof Response) {
      if (e.status >= 300 && e.status < 400) throw e;
      await sessionStorage.deleteSession(session.id);
      // eslint-disable-next-line no-undef
      return { apiKey: process.env.SHOPIFY_API_KEY || "", needsReauth: true, shop: session.shop };
    }
    // Expired token via a plain Error object (networkStatusCode === 403 etc.)
    if (isExpiredToken(e)) {
      await sessionStorage.deleteSession(session.id);
      // eslint-disable-next-line no-undef
      return { apiKey: process.env.SHOPIFY_API_KEY || "", needsReauth: true, shop: session.shop };
    }
    // Billing unreachable — fall through with the Free entitlements already in
    // `features` rather than locking the merchant out of a working app.
  }

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    features,
  };
};

export default function App() {
  const { apiKey, needsReauth, shop, features } = useLoaderData();

  // Expired token: break out of the Shopify iframe so OAuth runs in the top frame
  useEffect(() => {
    if (needsReauth && shop) {
      window.top.location.href = `/auth?shop=${shop}`;
    }
  }, [needsReauth, shop]);

  if (needsReauth) return null;

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <ui-nav-menu>
          <a href="/app" rel="home">Home</a>
          <a href="/app/productoptimization">Image Optimization</a>
          {features?.altText && (
            <a href="/app/alttextsuggestions">Alt Text Generator</a>
          )}
          {features?.pageSpeed && (
            <a href="/app/pagespeedimpactreports">Page Speed Reports</a>
          )}
          <a href="/app/imageoptimizationdashboard">Analytics</a>
          <a href="/app/billing">Billing</a>
        </ui-nav-menu>
        <Outlet />
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
