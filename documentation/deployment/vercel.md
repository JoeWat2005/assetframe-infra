# Vercel deployment

The web app is hosted on Vercel and auto-deploys from GitHub.

## Project setup

- **Git repo:** `JoeWat2005/assetframe` (GitHub). Vercel is connected for auto-deploy.
- **Root directory: `web`.** The repo root is `mvp/`; the Next.js app lives in `mvp/web/`. The Vercel project's Root Directory must be set to `web` so build/install run there. NOT VERIFIED here whether this is `web` or `mvp/web` in the dashboard — confirm in Project Settings -> General -> Root Directory; it must point at the folder containing `package.json`/`next.config.ts`.
- **Framework preset:** Next.js. Build command `next build` (`npm run build`); install `npm install`; output is the default `.next`.
- **Node:** the app targets Next.js 16 / React 19; use Vercel's current default Node unless a specific pin is required (NOT VERIFIED — no `engines` field in `package.json`).

## Branch -> environment mapping

| Git branch | Vercel environment | URL | Keys / data |
| --- | --- | --- | --- |
| `main` | Production | `www.assetframe.co.uk` | Live Clerk, live Lemon Squeezy, Neon `main` branch |
| `development` | Preview | `*.vercel.app` (branch URL) | Clerk **test** keys, Neon `development` branch |
| any other branch / PR | Preview | per-deployment `*.vercel.app` | Preview env vars |

`site.config.ts` derives the correct absolute base URL from `VERCEL_ENV` + the re-exposed `VERCEL_*` vars (`next.config.ts`): production uses `NEXT_PUBLIC_SITE_URL` or the production domain; preview uses its own branch/deployment URL; local uses localhost. This keeps canonical URLs, OpenGraph, sitemap, robots host, and Clerk redirect origins honest per environment.

## Environment variables

Set every applicable var from `environment-variables.md` in **Project Settings -> Environment Variables**, scoped per environment:

- **Production:** live `pk_live_*`/`sk_live_*` Clerk, live Lemon Squeezy secrets, `DATABASE_URL` (Neon main), R2 keys, `CRON_SECRET`, VAPID keys, `RESEND_*`, `GOOGLE_*`.
- **Preview:** `pk_test_*`/`sk_test_*` Clerk, `DATABASE_URL` pointed at Neon `development` (or rely on `DATABASE_URL_DEV` syncing), test Lemon Squeezy.

> Vercel secrets are write-only once set — you cannot read a value back, only overwrite it. Keep a copy in your password manager. (Per project memory: live Clerk secret rotation and adding Preview test keys are known follow-ups.)

## Cron

`web/vercel.json` registers one cron:

```json
{ "crons": [ { "path": "/api/cron/new-editions", "schedule": "0 7 * * *" } ] }
```

- Runs **daily at 07:00 UTC**, hitting `/api/cron/new-editions` (the push + email fan-out; the app publishes editions at 06:00 London, so 07:00 UTC is after the drop in winter and an hour after in summer).
- Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the route rejects everything if `CRON_SECRET` is unset (fail-closed). **Cron will silently 401 in production until `CRON_SECRET` is set in the Production env.**
- The route is `force-dynamic` with `maxDuration = 60`.
- Crons run on the **Production** deployment only (standard Vercel behaviour).

## CSP and the Vercel Toolbar

`next.config.ts` enforces a Content-Security-Policy. The Vercel Toolbar (preview comments) loads `feedback.js` from `vercel.live` and uses Pusher; the CSP allow-lists `vercel.live`/`*.pusher.com` **only when `VERCEL_ENV === "preview"`**, so production stays locked down. (Per project memory, committing the `vercel.live` CSP allowance was a tracked TODO — it is present in `next.config.ts`.)

## Deploy flow

1. Push to `development` -> Preview deploy; verify on the `*.vercel.app` URL.
2. Merge `development` -> `main` -> Production deploy to `www.assetframe.co.uk`.
3. Editions are published separately by the engine and committed (see `../operations/publication-workflow.md`); the commit that lands `web/content/*.json` triggers a redeploy that serves the new catalog.

## Domain

`www.assetframe.co.uk` is the production domain. Confirm it is assigned to the Production environment and that the apex/`www` redirect is configured in Vercel -> Domains (NOT VERIFIED here).

## Related docs

- `environment-variables.md`, `neon.md`, `r2.md`, `production-checklist.md`, `rollback.md`.
- `../operations/daily-operations.md` (the cron in the daily rhythm).
