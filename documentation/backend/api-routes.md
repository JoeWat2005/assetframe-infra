# API route handlers

Every handler under `app/api/**` plus the `/.well-known/*` routes. Public REST endpoints are detailed in `../api/endpoints.md`; the MCP server in `../mcp/`. This page is the backend-side index with auth, side effects and security.

## Public REST (`/api/v1/*`) — no auth, CORS-open

| Route | Methods | Handler | Notes |
|---|---|---|---|
| `/api/v1/reports` | GET, OPTIONS | `app/api/v1/reports/route.ts` | `listReports()`; query params `asset_class,status,date,q,limit`; `force-dynamic`. |
| `/api/v1/reports/[date]/[slug]` | GET, OPTIONS | `.../[date]/[slug]/route.ts` | `isValidReportRef(date,slug)` guard then `getReportDetail()`; 404 JSON on miss/invalid. |
| `/api/v1/track-record` | GET, OPTIONS | `.../track-record/route.ts` | `getTrackRecordPayload()`. |
| `/api/v1/openapi.json` | GET, OPTIONS | `.../openapi.json/route.ts` | `force-static`; OpenAPI 3.1 doc; long CDN cache. |

All four respond via `lib/http.ts` helpers (`apiJson` adds CORS + `public, max-age=60, s-maxage=300`; `apiPreflight` returns 204). Every payload carries `SITE.disclaimer`. Pro file keys / `hidden` are never serialised. See `../api/`.

## MCP & OAuth discovery

| Route | Methods | Handler | Notes |
|---|---|---|---|
| `/api/mcp` | GET, POST, DELETE | `app/api/mcp/route.ts` | Streamable HTTP MCP server (`mcp-handler`); five tools; `get_pro_report` gated by Clerk OAuth + subscription; `maxDuration = 60`. |
| `/.well-known/oauth-authorization-server` | GET, OPTIONS | route.ts | RFC 8414 metadata proxied from Clerk. |
| `/.well-known/oauth-protected-resource` | GET, OPTIONS | route.ts | RFC 9728 metadata pointing MCP clients at Clerk. |

See `../mcp/auth.md` and `../mcp/tools.md`.

## Gated report file serving

**`/api/report/[...key]`** — `app/api/report/[...key]/route.ts`, GET, `force-dynamic`.
- All report bytes live in **private** R2 and are served only through here (`proxy.ts` does NOT expose any static report path).
- `classifyReportKey(objectKey)` (`lib/report-key.ts`) validates the key against an anchored allow-list: `<date>/<slug>/free.(html|pdf)`, `.../pro.(html|pdf)`, `.../preview.png`. Invalid -> 400. Blocks path traversal, query strings, alternate separators (linear/anchored regex, not ReDoS-prone).
- **Tiers:** `preview.png` is public (cacheable, 600s signed URL); `free.*` needs `ent.signedIn` (else 302 to `/sign-in?redirect_url=...`); `pro.*` needs `ent.subscribed` (else 302 to `/pricing`).
- On success: 302 to a short-lived signed R2 URL (public 600s + cacheable header; gated 120s + `private, no-store`). 503 if R2 unconfigured.
- Best-effort Pro download logging into `download_log`, deduped per `(user, report, kind)` per hour so a caller can't inflate KPIs. A logging failure never breaks the download.

See `../api/auth.md`, `../storage/` (owned elsewhere).

## Webhooks (signature-verified, public endpoint)

| Route | Methods | Verifies | Acts on |
|---|---|---|---|
| `/api/webhooks/clerk` | POST | Svix HMAC-SHA256 over `{id}.{ts}.{body}`, ts within ±300s (`lib/clerk-webhook.ts`) | `user.deleted` only: cancels the user's Lemon Squeezy subs at period end, deletes the mapping only on successful cancel, logs audit. |
| `/api/webhooks/lemonsqueezy` | POST | HMAC-SHA256 of raw body, `X-Signature`, timing-safe (`lib/lemonsqueezy.ts`) | Subscription lifecycle -> sets Clerk `subscribed` + billing metadata, upserts `billing_subscriptions`, logs audit. |

Both `force-dynamic`, return 401 on bad signature, 400 on unparseable body, 500 on DB failure. Lemon Squeezy details: variant-id allow-list (`LEMONSQUEEZY_VARIANT_IDS`), account resolution order (durable mapping -> signed checkout token -> verified-email hint -> unique email lookup -> unresolved+logged), staleness/idempotency check (`updated_at <= last applied -> skipped`), and force-revoke on `subscription_payment_refunded`. See `../billing/` and `../security/` (owned elsewhere).

## Newsletter confirm / unsubscribe (token, public)

| Route | Methods | Logic |
|---|---|---|
| `/api/subscribe/confirm` | GET | `confirmByToken(?token)` -> sets `subscribers.status='confirmed'`, **clears** `confirm_token` (single-use). Always 200 HTML (`lib/http.ts htmlPage`), graceful "Link expired" on miss. |
| `/api/unsubscribe` | GET | `unsubscribeByToken(?token)` -> `status='unsubscribed'`, does **not** clear the token (idempotent, RFC 8058 one-click). Always 200 HTML. |

Tokens are `crypto.randomUUID()` minted in `subscribeNewsletter`. See `server-actions.md`.

## Cron

**`/api/cron/new-editions`** — GET, `force-dynamic`, `maxDuration = 60`.
- Auth: `isAuthorizedCron(req)` requires `Authorization: Bearer ${CRON_SECRET}`, constant-time compare, fails closed if `CRON_SECRET` unset. 401 otherwise.
- Sends the day's new-edition notifications: web push first (digest topic + per-instrument to followers, prunes expired endpoints), email fallback (Resend) only to confirmed subscribers / followers with no active push sub. Returns `{ ok, editions, pushes, digests, alerts }`.

## View beacon

**`/api/report-view`** — POST, `force-dynamic`. No auth. Validates the `{id}` shape (`YYYY-MM-DD/slug`), upserts `report_views (edition_id, day, count)`. Always 204 (best-effort; dedupe is client-side per session). Powers `getTrending()`.

## Related docs

- `server-actions.md`, `middleware.md`, `error-handling.md`.
- `../api/endpoints.md`, `../mcp/tools.md`.
