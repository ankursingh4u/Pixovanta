# Pixovanta

Shopify media library manager — finds duplicate files by content, surfaces
files no product references, and renames files in bulk with a full preview.

Built on React Router 7 + Shopify Polaris + Prisma (PostgreSQL).

## Features

| Surface | Route | Gated by |
| --- | --- | --- |
| Home / media dashboard | `/app` | — |
| Duplicate Finder | `/app/duplicatefinder` | `duplicates` (all plans) |
| Unused Files | `/app/unusedfiles` | `unused` (Growth+) |
| Bulk Rename | `/app/bulkrename` | `rename` (Starter+) |
| Billing | `/app/billing` | — |
| Pricing wall | `/app/pricing` | shown when no active plan |
| Privacy policy (public) | `/privacy` | — |

Internal endpoint: `/healthz` (readiness probe used by the container health
check and the Coolify proxy).

### How the features work

- **Duplicate Finder** — downloads each file once from the Shopify CDN,
  SHA-256s the bytes, and caches the fingerprint by CDN url (`FileHash`).
  Shopify CDN urls carry `?v=<version>` that changes when the bytes change, so
  the cache can never go stale. Files with identical hashes are grouped; the
  oldest copy in each group is the default "keep".
- **Unused Files** — diffs the file library against every product's media ids.
  It deliberately reports only images/videos "not used by any product" (never
  "safe to delete") because theme/page/blog usage is by URL and not visible.
  Generic files are excluded entirely.
- **Bulk Rename** — `fileUpdate` with a new `filename`. The extension must
  match the original (Files API rule) and videos can't be renamed, so both are
  enforced in the transform. Every change is previewed before apply.

Metering: fresh duplicate-scan hashes and applied renames count against the
plan's monthly `monthlyFiles` quota; deletes, previews, unused-file scans, and
cache-hit re-scans are free.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `SHOPIFY_API_KEY` | App client ID |
| `SHOPIFY_API_SECRET` | App client secret |
| `SHOPIFY_APP_URL` | Public HTTPS URL of this deployment |
| `SCOPES` | `write_products,write_files` |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | `3000` |

### Optional

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHOPIFY_APP_HANDLE` | `pixovanta` | Fallback handle for the managed-pricing URL. Only used if Shopify's own `currentAppInstallation.app.handle` is unavailable. |
| `LEGAL_ENTITY_NAME` | `SDLC Limited` | Operator name shown on `/privacy`. |
| `PRIVACY_CONTACT_EMAIL` | *(unset)* | Contact address shown on `/privacy`. While unset the page points merchants at the App Store listing's support contact instead — set it before submitting for review. |
| `BILLING_*` | see `app/billing.server.js` | Display-only pricing copy (real prices live in the Partner Dashboard). |
| `DEV_PLAN_OVERRIDE` | — | **Never set in production.** Forces a plan tier for testing on a dev store. |

## Billing model

This is a Shopify **Managed Pricing** app. Plans are created in the Partner
Dashboard and merchants subscribe on Shopify's hosted pricing page — the app
cannot create charges. At runtime the app reads the active subscription's *name*
and maps it to a tier in `app/plans.server.js`, which decides the monthly
file-operation quota and which features unlock.

Plan names in the Partner Dashboard **must** match `Free`, `Starter`, `Growth`,
`Pro` (a trailing ` Annual` is stripped before matching).

## Privacy & compliance webhooks

`shopify.app.toml` routes `app/uninstalled` **and** the three mandatory GDPR
topics (`customers/redact`, `customers/data_request`, `shop/redact`) to the single
`/webhooks/app/uninstalled` endpoint, so that handler branches on `topic`:

| Topic | Action |
| --- | --- |
| `APP_UNINSTALLED` | Delete `Session`, `UsageCounter` for the shop |
| `SHOP_REDACT` | Same deletion, unconditionally (no session left to gate on) |
| `CUSTOMERS_REDACT` / `CUSTOMERS_DATA_REQUEST` | Acknowledge — the app holds no customer data |

The app requests only `write_products,write_files`, so it cannot read customers,
orders or checkouts. `FileHash` is keyed by CDN url with no shop column and is
intentionally kept as a cache.

Public policy page: [`/privacy`](app/routes/privacy.jsx). It documents actual
code behaviour — if you change `prisma/schema.prisma`, what is downloaded for
hashing, or what the webhook deletes, update that page to match.

## Local development

```bash
npm install
npx prisma generate
npm run dev          # shopify app dev
```

## Production

The `Dockerfile` installs dependencies, runs `prisma generate` and
`react-router build`, then starts with `npm run docker-start`
(`prisma db push` followed by `node ./server.js`). A Docker `HEALTHCHECK`
polls `/healthz`.

### Why `server.js` instead of `react-router-serve`

`react-router-serve` never sets Express's `trust proxy`, and offers no flag to.
Behind a TLS-terminating reverse proxy (Coolify/Traefik here) that makes
`req.protocol` report `http`, so `@react-router/express` builds
`request.url` as `http://<host>/…` while the browser sends
`Origin: https://<host>` on every POST. React Router's
`throwIfPotentialCSRFAttack` compares the two and rejects the request with
**400 Bad Request** — breaking *every* action in the app (scans, renames,
deletions, cancel) while all GET pages keep working. Shopify's webhook POSTs
are unaffected because server-to-server requests send no `Origin`.

`server.js` is the stock `react-router-serve` middleware stack plus
`app.set("trust proxy", …)`. It also pins `allowedActionOrigins` to the host in
`SHOPIFY_APP_URL` as a safety net, so actions keep working if the proxy ever
stops sending `X-Forwarded-Proto`. Requests from any other origin are still
rejected.

| Variable | Default | Purpose |
| --- | --- | --- |
| `TRUST_PROXY` | `1` | Number of proxy hops to trust. Raise if you put another proxy (e.g. Cloudflare) in front of Traefik. |
