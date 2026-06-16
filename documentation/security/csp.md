# Security — Content Security Policy

## Status: ENFORCED

The CSP is applied as the **`Content-Security-Policy`** header (enforcing — the browser blocks anything not allow-listed), not report-only. It is built in `next.config.ts` and attached to every response via the `headers()` config (`source: "/:path*"`).

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\next.config.ts`

## The policy (production / local)

| Directive | Value |
| --- | --- |
| `default-src` | `'self'` |
| `script-src` | `'self' 'unsafe-inline'` + Clerk (`*.clerk.accounts.dev`, `*.clerk.com`, `clerk.assetframe.co.uk`), Cloudflare Turnstile (`challenges.cloudflare.com`), Google Tag Manager, `*.vercel-scripts.com` |
| `style-src` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' data: blob:` + Clerk images, `*.assetframe.co.uk`, `*.r2.cloudflarestorage.com`, GTM, `www.google-analytics.com` |
| `font-src` | `'self' data:` |
| `connect-src` | `'self'` + Clerk + Clerk telemetry, Google Analytics domains, GTM, `vitals.vercel-insights.com`, `*.vercel-scripts.com` |
| `frame-src` | `'self'` + Clerk + `*.assetframe.co.uk` + Turnstile |
| `worker-src` | `'self' blob:` |
| `frame-ancestors` | `'self'` |
| `base-uri` | `'self'` |
| `form-action` | `'self' *.lemonsqueezy.com *.clerk.accounts.dev *.clerk.com` |
| `object-src` | `'none'` |
| `upgrade-insecure-requests` | (set) |

## Why each third party is allowed

- **Clerk** — auth widgets/frames (`frame-src`), telemetry + API (`connect-src`), avatar images (`img-src`), and both the dev domains and the production custom domain `clerk.assetframe.co.uk`. See [../auth/clerk.md](../auth/clerk.md).
- **Cloudflare Turnstile** (`challenges.cloudflare.com`) — Clerk's bot-check, in `script-src` + `frame-src`.
- **Google Analytics / Tag Manager** — `script-src`/`connect-src`/`img-src`. Gated by `NEXT_PUBLIC_GA_ID`.
- **Vercel Analytics / Speed Insights** — `*.vercel-scripts.com`, `vitals.vercel-insights.com`.
- **Cloudflare R2** (`*.r2.cloudflarestorage.com`) — `img-src`, so signed preview thumbnails render. See [../storage/signed-urls.md](../storage/signed-urls.md).
- **Lemon Squeezy** — only in `form-action`; checkout is a top-level navigation (`window.location`), so it is **not** otherwise constrained.

## Preview-only relaxation (Vercel Toolbar)

The Vercel Toolbar (preview comments) loads `feedback.js` from `vercel.live` and uses Pusher for live updates. These are added **only when `VERCEL_ENV === "preview"`**:
- `liveScript` -> `script-src https://vercel.live`
- `liveConnect` -> `connect-src https://vercel.live wss://*.pusher.com https://*.pusher.com`
- `liveFrame` -> `frame-src https://vercel.live`
- `liveImg` -> `img-src https://vercel.live https://vercel.com`

Production and local stay locked down exactly as before.

> Memory note ("commit vercel.live CSP") matches this preview-only block in `next.config.ts`.

## Documented backlog: `script-src 'unsafe-inline'`

`'unsafe-inline'` is **still permitted** for scripts (and styles): it is needed for the Next bootstrap inline script, Clerk, and Recharts/Tailwind inline styles. The file's own comment states the hardened follow-up: **replace `'unsafe-inline'` with a per-request nonce.** This is the single biggest CSP weakness — with `'unsafe-inline'`, the CSP does not stop an injected inline `<script>`. Tracked as backlog (nonce migration). See [threat-model.md](./threat-model.md).

## Fast rollback

To roll back if something legitimate is blocked, rename the header key at the bottom of `next.config.ts` from `Content-Security-Policy` back to `Content-Security-Policy-Report-Only` (reports violations without blocking).

## Tests

> NOT VERIFIED: there is no automated test asserting the CSP string. CSP correctness is validated manually / via the report-only rollback path. (The security test suite covers webhooks and report-key validation, not headers.)

## Related docs

- [security-headers.md](./security-headers.md) · [threat-model.md](./threat-model.md) · [../auth/clerk.md](../auth/clerk.md)
