# Environment variables

This is the complete environment-variable reference, grounded in `web/.env.example`, `web/site.config.ts`, `web/next.config.ts`, and the `lib/*` modules that read each one. Set the same values in Vercel (per environment) that you set in `web/.env.local` for local dev.

## Rules

- `NEXT_PUBLIC_*` are inlined into the browser bundle at build time — **public, never secret**. Everything else is server-only.
- Each environment (Production / Preview / local) builds separately, so per-environment values are correct. Production uses live keys; Preview uses test keys (see `vercel.md`).
- Secrets live only in Vercel env + the gitignored `web/.env.local`. `publish.py` auto-loads `web/.env.local` for the R2 keys, and `sync-db.mjs` auto-loads missing DB keys from it too.

## Site (public)

| Var | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Optional (recommended in prod) | Override for the absolute base URL. In prod, falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `https://www.assetframe.co.uk`. Locally defaults to `http://localhost:3000`. (`site.config.ts`) |
| `NEXT_PUBLIC_CHECKOUT_URL` | Optional | Lemon Squeezy buy link. Has a hard-coded default in `site.config.ts`. |
| `NEXT_PUBLIC_PRO_PRICE` | Optional | Price label (default `£9.99/month`). Must match the Lemon Squeezy variant price. Also drives MRR math on `/admin`. |
| `NEXT_PUBLIC_LEMON_PORTAL_URL` | Optional | Self-serve billing portal link (default `https://app.lemonsqueezy.com/my-orders`). |
| `NEXT_PUBLIC_ANALYTICS_URL` | Optional | Admin "Vercel Analytics" card link (default `https://vercel.com/dashboard`). |
| `NEXT_PUBLIC_GA_URL` | Optional | Admin "Google Analytics" card link (default `https://analytics.google.com/`). |
| `NEXT_PUBLIC_GA_ID` | Optional | GA4 Measurement ID. Enables GA + the cookie-consent banner. **Defaults to `G-QK5EM4V2LJ` in production** when unset; undefined in dev. (`components/ConsentAnalytics.tsx`) |

## Database — Neon Postgres

| Var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes (for any DB-backed feature) | Pooled Neon connection string for the **production / `main`** branch. Read by `lib/db.ts` and `sync-db.mjs`. `sync-db.mjs` also accepts `POSTGRES_URL` / `STORAGE_DATABASE_URL` / `STORAGE_URL` as fallbacks. |
| `DATABASE_URL_DEV` | Optional | Neon **`development`** branch (used by preview deploys). When set, `sync-db.mjs` updates BOTH this and `DATABASE_URL` on every publish so prod + preview stay in lockstep. Fallback name: `DEV_DATABASE_URL`. |

If neither is set, `sql` is null and all DB queries are skipped (the app still renders). See `neon.md`.

## Clerk auth

| Var | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (`pk_test_*` for preview/dev, `pk_live_*` for prod). |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key. Also the fallback signer for the checkout token if `CHECKOUT_TOKEN_SECRET` is unset. |
| `CLERK_WEBHOOK_SECRET` | Optional (needed for account-deletion sync) | Svix signing secret for `/api/webhooks/clerk`. Verified by `lib/clerk-webhook.ts`; cancels the LS subscription when a user deletes their account. |

## Admin

| Var | Required | Purpose |
| --- | --- | --- |
| `ADMIN_EMAILS` | Recommended | Comma-separated emails that get the admin dashboard before Clerk roles are set. Lowercased + trimmed in `lib/entitlements.ts`; matched exactly against the (lowercased) caller email. See `../admin/permissions.md`. |

## Lemon Squeezy (billing)

| Var | Required | Purpose |
| --- | --- | --- |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Yes (for billing) | HMAC secret for `/api/webhooks/lemonsqueezy`. Verified by `verifyLemonSignature` (`lib/lemonsqueezy.ts`). |
| `LEMONSQUEEZY_API_KEY` | Optional | Enables in-app subscription cancel (`cancelLemonSubscription`). Without it, the admin "revoke a paying subscriber" path and self-serve cancel fall back to the portal. |
| `LEMONSQUEEZY_VARIANT_IDS` | Optional | Comma-separated variant ids allowed to grant Pro. Empty = allow all. |

## Checkout binding

| Var | Required | Purpose |
| --- | --- | --- |
| `CHECKOUT_TOKEN_SECRET` | Optional | Any long random string; signs the checkout->account token (`lib/checkout-token.ts`). Falls back to `CLERK_SECRET_KEY` if unset, so the token is always signed. |

## Cloudflare R2 (private Pro/free files)

| Var | Required | Purpose |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Yes (for downloads) | Cloudflare account id; forms the S3 endpoint `https://<id>.r2.cloudflarestorage.com`. |
| `R2_ACCESS_KEY_ID` | Yes | R2 S3 access key. |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 S3 secret key. |
| `R2_BUCKET` | Yes | Bucket name (`assetframe-pro`). |

Read by `lib/r2.ts` (server) and `publish.py` (upload). If unset, the report route returns 503 cleanly. See `r2.md`.

## Cron

| Var | Required | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | Yes (to enable the cron in prod) | Bearer token Vercel Cron sends to `/api/cron/new-editions`. The gate is **fail-closed**: with no secret set, the endpoint rejects everything (`lib/cron.ts`). Set it in Vercel so the scheduled job can authenticate. |

## Web push (VAPID) — primary alert channel

| Var | Required | Purpose |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Optional (needed for push) | VAPID public key. (`lib/push.ts`) |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key. |
| `VAPID_SUBJECT` | Optional | `mailto:` address or https URL for the push service. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | The **same** public key, exposed to the browser so `PushToggle` can subscribe. Must equal `VAPID_PUBLIC_KEY`. |

Generate the keypair with `npx web-push generate-vapid-keys`. All four must be set for push; when any is missing, `pushConfigured` is false and the new-editions cron falls back to email-everyone (identical to the pre-push behaviour). **These are NOT yet in `.env.example`** — track them in `production-checklist.md`.

## Email (Resend) — fallback channel

| Var | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Optional (needed for email) | Resend API key. When absent, `sendEmail` returns `{skipped:true}` and no email is sent. (`lib/email.ts`) |
| `RESEND_FROM` | Recommended in prod | Verified sender, e.g. `AssetFrame <alerts@assetframe.co.uk>`. Default is Resend's shared `onboarding@resend.dev`, which only delivers to the account owner until your domain is verified. |

**NOT in `.env.example`** — track in `production-checklist.md`.

## Google reviews

| Var | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_MAPS_API_KEY` | Optional | Places API key for `/reviews` (`lib/google-reviews.ts`). |
| `GOOGLE_PLACE_ID` | Optional | The Google Place ID to pull reviews for. |

**NOT in `.env.example`** — track in `production-checklist.md`.

## Vercel system vars (set automatically)

`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` are provided by Vercel and re-exposed as `NEXT_PUBLIC_*` in `next.config.ts` for `site.config.ts`'s URL resolution. Do not set these by hand.

## Related docs

- `vercel.md`, `neon.md`, `r2.md`, `production-checklist.md`.
- `../testing/integration-tests.md` (the manual push playbook needs the VAPID + CRON_SECRET + RESEND vars).
- `../analytics/tracking.md` (`NEXT_PUBLIC_GA_ID`).
