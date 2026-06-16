# REST API auth & access

## The free REST API has no auth

`/api/v1/reports`, `/api/v1/reports/{date}/{slug}`, `/api/v1/track-record` and `/api/v1/openapi.json` require **no API key, no token, no sign-in**. They are CORS-open (`Access-Control-Allow-Origin: *`) and serve only free-tier data. This is intentional: the catalog, the free Snapshot, and the public track record are meant to be openly readable and citable.

The `Access-Control-Allow-Headers` list includes `Authorization` for client convenience, but the endpoints **do not read or require** it.

## The Pro analysis is not on the REST API

There is no REST endpoint that returns Pro report text or a Pro file link. The detail endpoint only signals availability (`proAvailable`, `proAccess` pointing to `/pricing`). Pro content is reachable two ways, both gated:

1. **Website** — `/api/report/{date}/{slug}/pro.(html|pdf)` (the gated file-serving route). Requires a Clerk session **and** `getEntitlement().subscribed`; otherwise 302 to `/sign-in` or `/pricing`. This is browser/session auth (cookies), not an API-key flow.
2. **MCP** — the `get_pro_report` tool, gated by Clerk OAuth + a live subscription. See `../mcp/auth.md`.

## Why the split

Free data over open REST maximises reach (agents, GPT Actions, LangChain) with zero onboarding, while the paid product stays protected:
- The REST payload builders (`lib/reports-api.ts`) never serialise Pro file keys or the `hidden` flag (enforced by `tests/api-v1-shape.test.ts`).
- All report **bytes** live in private R2 and are only ever vended through the auth-gated `/api/report/[...key]` route with a short-lived signed URL — there is no public/static report path (`proxy.ts` comment).

## Input validation as a guard

`isValidReportRef(date, slug)` (`lib/report-key.ts`) rejects malformed identifiers on the detail route before any lookup — anchored date grammar + slug `[A-Za-z0-9_-]+` capped at 64 chars. This blocks path-traversal / garbage slugs and over-long inputs even though the DB queries are parameterised. Same anchored grammar (`classifyReportKey`) gates the file-serving route and assigns its tier (`public` preview / `free` / `pro`).

## Rate limiting / abuse

- No per-key rate limiting (there are no keys). Responses are edge-cached (`s-maxage=300`) to keep load cheap.
- The gated file route dedupes Pro-download logging per `(user, report, kind)` per hour so an authenticated caller can't inflate KPIs.
- **NOT VERIFIED:** whether a platform-level WAF/rate-limit (e.g. Vercel Firewall) sits in front of `/api/v1/*` — not visible in the application code.

## Related docs

- `overview.md`, `endpoints.md`, `examples.md`.
- `../backend/middleware.md` — Clerk context + entitlement derivation.
- `../backend/api-routes.md` — the gated `/api/report` route.
- `../mcp/auth.md` — OAuth for the Pro MCP tool.
