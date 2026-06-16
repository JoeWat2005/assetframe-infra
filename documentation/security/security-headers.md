# Security — HTTP security headers

All baseline security headers are defined in `next.config.ts` and applied to **every** response via `headers()` with `source: "/:path*"`. (The CSP is one of these headers; it has its own page — see [csp.md](./csp.md).)

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\next.config.ts`

## The headers

| Header | Value | Purpose |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | force HTTPS for 2 years, all subdomains, preload-list eligible |
| `X-Content-Type-Options` | `nosniff` | block MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | anti-clickjacking (legacy header; CSP `frame-ancestors 'self'` is the modern equivalent) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | send only origin cross-site |
| `X-DNS-Prefetch-Control` | `on` | allow DNS prefetch |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | deny camera/mic/geolocation; opt out of Topics |
| `Content-Security-Policy` | (see [csp.md](./csp.md)) | enforced CSP |

## Other hardening in `next.config.ts`

- **`poweredByHeader: false`** — removes the `X-Powered-By: Next.js` fingerprinting header.
- **`env` re-exposure** — Vercel system vars (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`) are re-exposed to the client as `NEXT_PUBLIC_*` so `site.config` can resolve the correct base URL per environment. These are non-secret deployment identifiers; each environment builds separately so values are correct per deploy.

## Defence-in-depth overlap

`X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'` both prevent the site being framed by a third party; keeping both covers older browsers that don't honour `frame-ancestors`. `upgrade-insecure-requests` (in the CSP) complements HSTS by upgrading any stray `http://` subresource.

## Coverage

Because the matcher is `/:path*`, the headers apply to pages, API routes, and the gated `/api/report` route alike. The gated route additionally sets its own per-response `Cache-Control` (`private, no-store` for gated files; cacheable for public previews) — see [../storage/signed-urls.md](../storage/signed-urls.md).

## Tests

> NOT VERIFIED: no automated test asserts these header values. They are static config in `next.config.ts`; verify in a deploy via response inspection.

## Related docs

- [csp.md](./csp.md) · [threat-model.md](./threat-model.md) · [../storage/signed-urls.md](../storage/signed-urls.md)
