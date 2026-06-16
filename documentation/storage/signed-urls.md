# Storage — Signed URLs (auth-gated delivery)

## The principle

R2 credentials never reach the client. Instead, the server mints a **short-lived presigned URL** for one specific object and 302-redirects the browser to it. The signed URL expires quickly, so even if it leaks it is useless within minutes, and it grants access to that one object only.

Files:
- Route: `C:\Users\cwatm\Desktop\advisor\mvp\web\app\api\report\[...key]\route.ts`
- Signer: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\r2.ts` (`signedReportUrl`)

## The gated route, end to end

`GET /api/report/<date>/<slug>/<file>` (`export const dynamic = "force-dynamic"`):

1. `objectKey = key.join("/")`; `tier = classifyReportKey(objectKey)`. `null` -> **400 "Bad request"**.
2. If `tier !== "public"`:
   - `ent = await getEntitlement()`.
   - `!ent.signedIn` -> **302** to `/sign-in?redirect_url=<current path>`.
   - `tier === "pro" && !ent.subscribed` -> **302** to `/pricing`.
   - If `tier === "pro"` and DB present: best-effort `download_log` insert, deduped per `(report_id, kind, user_id)` within the last hour.
3. `signed = await signedReportUrl(objectKey, tier === "public" ? 600 : 120)`. `null` -> **503**.
4. **302** to the signed URL, with `Cache-Control`:
   - public -> `public, max-age=300, s-maxage=300` (cacheable; it's a thumbnail)
   - gated  -> `private, no-store, max-age=0` (never cache a Pro/free link)

## Expiry windows

| Tier | `expiresIn` | Redirect cache |
| --- | --- | --- |
| public (`preview.png`) | **600s** | cacheable (5 min) |
| free / pro | **120s** | `private, no-store` |

`signedReportUrl` defaults to **120s**; the route passes 600s only for public previews. The 120s window is the documented value for gated files ("expires in two minutes").

## Why redirect instead of proxy

The bytes render on the R2 origin (the browser fetches the signed URL directly), so the Next server doesn't stream large PDFs/HTML through itself. The server's only job is the entitlement check + signing. This keeps the function fast and avoids buffering report payloads.

## Content delivery for agents (not redirect)

The REST API / MCP tools that return report **text** to an agent don't redirect — they call `getObjectText(key)` (`lib/r2.ts`) to read the bytes server-side and return them inline. The Pro variant is OAuth-gated and resolves keys via `getEditionProKeys`. See [../auth/entitlement-checks.md](../auth/entitlement-checks.md).

## Security properties

- **No public report URL exists** — the proxy doesn't serve report files; this route is the only door, and it always classifies + (for non-public) checks entitlement before signing. See [../security/auth-boundaries.md](../security/auth-boundaries.md).
- **Key is validated before signing** — a traversal/garbage key returns 400 and is never presigned. See [report-assets.md](./report-assets.md) and [../security/input-validation.md](../security/input-validation.md).
- **Short TTL** — a leaked gated URL dies in ~120s and is marked `no-store`.
- **Open-redirect note:** the 302 target is built by the server from a fixed bucket + a validated object key, not from user-controlled input, so it can't be steered to an arbitrary host.

## Failure modes

| Condition | Status |
| --- | --- |
| Bad/garbage key | 400 |
| Not signed in (free/pro) | 302 -> /sign-in |
| Signed in but not subscribed (pro) | 302 -> /pricing |
| R2 not configured | 503 |
| OK | 302 -> signed R2 URL |

## Tests

The classification feeding this route is covered by `tests/sec-report-key.test.ts`; entitlement behaviour at the API boundary by `tests/api-entitlement.test.ts`. (The presign call itself wraps the live AWS SDK and isn't unit-tested.)

## Related docs

- [r2.md](./r2.md) · [report-assets.md](./report-assets.md) · [overview.md](./overview.md)
- [../auth/entitlement-checks.md](../auth/entitlement-checks.md) · [../security/auth-boundaries.md](../security/auth-boundaries.md)
