# Security — Input validation

AssetFrame's untrusted inputs are: object keys on `/api/report`, `date`/`slug` path params on the public REST/MCP endpoints, webhook bodies (covered in [webhook-security.md](./webhook-security.md)), and server-action arguments. The defences are anchored allow-lists, length caps, and parameterized SQL everywhere.

## Anchored allow-list for report keys

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\report-key.ts`

`classifyReportKey(key)` only accepts three exact shapes (anchored `^...$`):
```
<DATE>/<SLUG>/pro.(html|pdf)
<DATE>/<SLUG>/free.(html|pdf)
<DATE>/<SLUG>/preview.png
```
where `DATE` is calendar-plausible (`\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])`) and `SLUG` is `[A-Za-z0-9_-]+`. Anything else -> `null` -> the route returns **400** and never signs an object. This blocks path traversal (`../`, `..%2f`, `....//`, backslashes), alternate separators, query strings, fragments, double extensions, wrong-case literals, and non-report objects (`.env`, `metadata.json`, `pro.exe`, `preview.jpg`). The expressions are **linear/anchored** -> not ReDoS-prone.

## `isValidReportRef(date, slug)` — REST/MCP guard

Same `DATE`/`SLUG` grammar plus a `SLUG_MAX = 64` length cap. The public detail endpoint `GET /api/v1/reports/{date}/{slug}` calls it **before** touching the data layer; a fail returns the same 404 shape as a real miss, so malformed/over-long/traversal slugs never reach a query:
```ts
if (!isValidReportRef(date, slug)) return apiJson({ error: "not_found", ... }, { status: 404 });
```
File: `app/api/v1/reports/[date]/[slug]/route.ts`. This is **defence in depth** — the lookups are already parameterized, but the validator stops garbage and DoS-y over-long inputs entirely.

## Parameterized SQL (no string interpolation of input)

Every database call uses `sql.query(text, params)` with bound `$1,$2,...` placeholders. Examples:
- report-download logging: `INSERT INTO download_log ... SELECT $1,$2,$3 WHERE NOT EXISTS (...)` with `[reportId, kind, email]`.
- push upsert: `INSERT INTO push_subscriptions (...) VALUES ($1..$5) ON CONFLICT (endpoint) DO UPDATE ...`.
- billing mapping, audit log, edition lookups — all parameterized.

The only places SQL is assembled by string concatenation are **static column lists / join fragments** in `lib/content.ts` (`EDITION_COLS`, `EDITION_FROM`, `OPEN_CALLS_FROM`) — these contain **no user input** (the dynamic edition-id is still passed as a bound `$1`). So there is no SQL-injection surface from request input.

## Server-action argument sanitisation

`lib/push-actions.ts` (`saveSubscription`):
- requires `auth().userId` (login);
- trims and presence-checks `endpoint` / `p256dh` / `auth`;
- **clamps topics**: `topics.map(t => String(t).slice(0,40)).filter(Boolean).slice(0,50)` — each topic <=40 chars, at most 50 topics, defending the `text[]` column against oversized/abusive input;
- `removeSubscription` scopes the delete to the caller's `clerk_user_id` (no cross-user deletes).

## Cron token

`isAuthorizedCron` (`lib/cron.ts`) length-checks then `timingSafeEqual`s the `Authorization` header against `Bearer <CRON_SECRET>`, fail-closed when unset. See [auth-boundaries.md](./auth-boundaries.md).

## Output side

Report files are system-generated (not user content) and delivered via redirect to a signed URL, so there is no reflected user input in those responses. CSP provides the backstop for any injected markup (with the documented `'unsafe-inline'` caveat) — see [csp.md](./csp.md).

## Backlog

- **No rate limiting** on `/api/*` (REST, webhooks, report route). Input is validated and rejected cheaply, but request **volume** is unbounded. Tracked as backlog (Vercel Firewall / Upstash). See [threat-model.md](./threat-model.md).

## Tests

`tests/sec-report-key.test.ts` + `tests/report-key.test.ts` exhaustively assert:
- traversal payloads classify `null`;
- malformed/non-report keys classify `null`;
- only the three intended tiers classify;
- `isValidReportRef` accepts good refs (incl. `SOL_2`, `BRK-B`), rejects traversal/separators/impossible dates/spaces/query+fragment/empty + 65-char slugs, and accepts the 64-char boundary.

## Related docs

- [../storage/report-assets.md](../storage/report-assets.md) · [webhook-security.md](./webhook-security.md) · [auth-boundaries.md](./auth-boundaries.md) · [csp.md](./csp.md)
