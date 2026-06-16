# Deployment overview

AssetFrame's web app (`mvp/web/`) is a Next.js 16 app deployed on **Vercel**, with state in **Neon Postgres**, private report files in **Cloudflare R2**, auth via **Clerk**, billing via **Lemon Squeezy**, transactional email via **Resend**, and web push via **VAPID**. The Python report engine (`mvp/scripts/`) runs locally/on a workstation, not on Vercel — it produces files and JSON that are pushed to R2 + Neon and committed to the repo.

## Topology

```
                 git push (GitHub: JoeWat2005/assetframe)
                          |
       main ----------------------------> Vercel PRODUCTION (www.assetframe.co.uk)
       development ------------------------> Vercel PREVIEW (*.vercel.app)
                          |
   Next.js app (root dir: web/) renders pages, gates downloads, runs:
     - /api/v1/*           public REST API (CORS-open, no key for free endpoints)
     - /api/mcp            MCP server (Streamable HTTP; Clerk OAuth for Pro)
     - /api/webhooks/*     Clerk + Lemon Squeezy inbound (signature-verified)
     - /api/report/[...key] gated R2 proxy (signed URLs)
     - /api/cron/new-editions  Vercel Cron 0 7 * * * (push + email fan-out)
                          |
   Neon Postgres (two branches: main = prod, development = preview)
   Cloudflare R2 (bucket: assetframe-pro, private; 120s signed URLs)
   Clerk (auth + user publicMetadata = entitlement source of truth)
   Lemon Squeezy (subscriptions; webhook writes entitlement to Clerk)
   Resend (email fallback) · VAPID/web-push (primary alerts)
```

## Two environments, two branches

This is the core deployment rule (see `vercel.md` and `neon.md`):

- **`main` -> Production.** Live Clerk keys, live Lemon Squeezy, Neon `main` branch, the `www.assetframe.co.uk` domain.
- **`development` -> Preview.** Clerk **test** keys, Neon `development` branch, the deployment's own `*.vercel.app` URL.

`site.config.ts` resolves the correct absolute base URL per environment from re-exposed `VERCEL_*` vars (`next.config.ts` inlines `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` as `NEXT_PUBLIC_*`). Previews never claim to be production.

## What deploys vs what is published

- **Code** deploys via Vercel on every push to `main`/`development`.
- **Editions** (report PDFs/HTML + catalog/track-record JSON) are **published** by the local engine, not by a deploy: `export_content.py` -> `publish.py` (R2) -> `sync-db.mjs` (Neon, both branches) -> commit `web/content/*.json` -> push. See `../operations/publication-workflow.md`.

## Build & graceful degradation

- Build command: `next build` (`npm run build`). Root directory in Vercel: `web`.
- Every external dependency degrades gracefully if its env is unset, so the app builds and runs in a bare environment: no DB (`lib/db.ts` -> `sql` is null, queries skipped), no R2 (`lib/r2.ts` -> route 503s cleanly), no Resend (`sendEmail` returns `{skipped:true}`), no VAPID (`pushConfigured=false`, cron falls back to email-everyone), no Clerk (admin stats still render from the DB). This is why partial config does not crash a deploy.

## Reference

| Concern | Doc |
| --- | --- |
| Every env var | `environment-variables.md` |
| Vercel project, branches, domain | `vercel.md` |
| Neon branches + migrations | `neon.md` |
| Cloudflare R2 bucket | `r2.md` |
| Go-live gate | `production-checklist.md` |
| Reverting a bad deploy | `rollback.md` |
| Day-to-day publishing | `../operations/daily-operations.md`, `../operations/publication-workflow.md` |
