# Storage — Overview

## What is stored where

| Asset | Store | Access |
| --- | --- | --- |
| Report files: `free.html`, `free.pdf`, `pro.html`, `pro.pdf`, `preview.png` | **Cloudflare R2** (private bucket `assetframe-pro`) | served only via gated `/api/report/[...key]` |
| Report **metadata** (catalogue, track record) | Neon Postgres (+ JSON fallback) | see [../database/schema.md](../database/schema.md) |
| Users | Clerk | — |
| Payments | Lemon Squeezy | — |

The database stores R2 **object keys** (`pro_html_key`, `pro_pdf_key`, `free_html_key`, `free_pdf_key`, `preview_key`), never file bytes.

## Object key layout

Every report object key has the shape:

```
<date>/<slug>/<file>
  e.g.  2026-06-15/ETH/pro.pdf
        2026-06-15/AAPL/free.html
        2026-06-15/WTI/preview.png
```

Only five filenames are valid per edition: `free.html`, `free.pdf`, `pro.html`, `pro.pdf`, `preview.png`. The allow-list grammar that enforces this is in `lib/report-key.ts` — see [report-assets.md](./report-assets.md).

## The one gated route

There is **no public/static path to any report file**. All five file types live in the private R2 bucket and are reachable only through:

```
GET /api/report/<date>/<slug>/<file>
```

(`app/api/report/[...key]/route.ts`). The route classifies the key, checks entitlement server-side, then 302-redirects to a short-lived **signed** R2 URL. Cloudflare credentials never leave the server. See [signed-urls.md](./signed-urls.md).

## R2 client

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\r2.ts` (`import "server-only"`).

- Uses the AWS S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) pointed at R2's S3-compatible endpoint `https://<accountId>.r2.cloudflarestorage.com`, `region: "auto"`.
- The client is built only when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` are all set; otherwise `client` is `null` and `r2Configured` is false.
- Exports: `signedReportUrl(key, expiresIn=120)`, `getObjectText(key)`, `r2Configured`.

## Env vars

| Var | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id (endpoint host) |
| `R2_ACCESS_KEY_ID` | R2 S3 access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3 secret |
| `R2_BUCKET` | bucket name (`assetframe-pro` in `.env.example`) |

If R2 isn't configured, the gated route returns **503** ("Report storage is not configured yet.") rather than erroring.

## Publishing

Report files are uploaded to R2 out-of-band by the publish workflow (`lib/publish.ts` + `scripts/publish.py` per project memory), and their keys land in `editions` via `sync-db.mjs` (Pro keys are derived as `<date>/<slug>/pro.{html,pdf}` when `hasPro`). The web app only ever **reads** from R2; it does not upload.

> NOT VERIFIED: the upload mechanics (`scripts/publish.py`, R2 bucket `assetframe-pro`) live outside the five owned doc areas and outside `web/lib`. `lib/r2.ts` is read-only (GET + presign). Confirm upload details in the publish tooling.

## Related docs

- [r2.md](./r2.md) · [report-assets.md](./report-assets.md) · [signed-urls.md](./signed-urls.md)
- [../auth/entitlement-checks.md](../auth/entitlement-checks.md) · [../security/input-validation.md](../security/input-validation.md)
