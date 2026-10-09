# Pixovanta

Shopify image optimization & SEO suite — compresses product images to WebP,
generates AI alt text, and reports the measured page-speed impact.

Built on React Router 7 + Shopify Polaris + Prisma (PostgreSQL) + sharp.

## Features

| Surface | Route | Gated by |
| --- | --- | --- |
| Home / dashboard | `/app` | — |
| Image Optimizer | `/app/productoptimization` | `optimize` (all plans) |
| AI Alt Text Generator | `/app/alttextsuggestions` | `altText` (Starter+) |
| Page Speed Reports | `/app/pagespeedimpactreports` | `pageSpeed` (Growth+) |
| Optimization Analytics | `/app/imageoptimizationdashboard` | — |
| Billing | `/app/billing` | — |
| Pricing wall | `/app/pricing` | shown when no active plan |
| Auto-optimize new products | `products/create` webhook | `autoOptimize` (Growth+) |

Internal endpoints: `/api/catalog` (product list, loaded after paint),
`/api/optimize` (per-image queue the optimizer page drives), `/healthz`
(readiness probe used by the container health check and the Coolify proxy).

Optimization results are written to **product metafields** in the
`pixovanta_opt` namespace — one `image_<id>` record per image plus an
`optimization_summary` per product — so the numbers survive a reinstall and stay
attached to the product they describe.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `SHOPIFY_API_KEY` | App client ID |
| `SHOPIFY_API_SECRET` | App client secret |
| `SHOPIFY_APP_URL` | Public HTTPS URL of this deployment |
| `SCOPES` | `write_products,write_files` |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | `3000` |
| `OPENAI_API_KEY` | AI alt text (GPT-4o-mini vision) |

### Optional

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHOPIFY_APP_HANDLE` | `pixovanta` | Fallback handle for the managed-pricing URL. Only used if Shopify's own `currentAppInstallation.app.handle` is unavailable. |
| `GOOGLE_PAGESPEED_API_KEY` | — | Raises the PageSpeed Insights rate limit. |
| `ANTHROPIC_API_KEY` | — | Alternative alt-text provider. |
| `WEBP_QUALITY` | `76` | First-pass WebP quality. |
| `WEBP_RETRY_QUALITY` | `66` | Second pass for already-compressed sources. |
| `WEBP_RETRY_BELOW` | `20` | Retry if the first pass saved less than this %. |
| `WEBP_EFFORT` | `5` | libwebp effort (0–6). |
| `MAX_IMAGE_DIM` | `2048` | Longest edge; images are never enlarged. |
| `MIN_GAIN_PERCENT` | `2` | Below this saving an image is left alone. |
| `SHARP_CONCURRENCY` | `2` | libvips thread cap. |
| `BATCH_SIZE` | `10` | Images per webhook batch call. |
| `BATCH_CONCURRENCY` | `6` | Concurrent images inside a batch. |
| `BILLING_*` | see `app/billing.server.js` | Display-only pricing copy (real prices live in the Partner Dashboard). |
| `DEV_PLAN_OVERRIDE` | — | **Never set in production.** Forces a plan tier for testing on a dev store. |

## Billing model

This is a Shopify **Managed Pricing** app. Plans are created in the Partner
Dashboard and merchants subscribe on Shopify's hosted pricing page — the app
cannot create charges. At runtime the app reads the active subscription's *name*
and maps it to a tier in `app/plans.server.js`, which decides the monthly image
quota and which features unlock.

Plan names in the Partner Dashboard **must** match `Free`, `Starter`, `Growth`,
`Pro` (a trailing ` Annual` is stripped before matching).

## Local development

```bash
npm install
npx prisma generate
npm run dev          # shopify app dev
```

## Production

The `Dockerfile` installs dependencies, runs `prisma generate` and
`react-router build`, then starts with `npm run docker-start`
(`prisma db push` followed by `react-router-serve`). A Docker `HEALTHCHECK`
polls `/healthz`.
