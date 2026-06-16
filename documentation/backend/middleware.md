# Middleware (proxy.ts) & auth context

## `proxy.ts` (the renamed middleware)

Next.js 16 in this project renames the `middleware` convention to **`proxy`** (see `web/AGENTS.md`). The file is `mvp/web/proxy.ts`:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
export default clerkMiddleware();
export const config = {
  matcher: ["/((?!_next|.*\.[^/]+$).*)", "/(api|trpc)(.*)"],
};
```

### What it does
- Runs `clerkMiddleware()` on every request matching the `matcher` (everything except `_next` internals and static files with an extension; API routes are explicitly included).
- It **attaches Clerk's auth context** so server components and route handlers can call `auth()` / `currentUser()` downstream.

### What it does NOT do
- It does **not** gate any page or API route. The source comment is explicit: report files are not gated here — every report (free + Pro) is private in R2 and served only through the auth-gated `/api/report` route, so there is no public/static report path.
- Authorization is enforced **per page / per route / per action**, not in the proxy:
  - Pages: `redirect()` in `/account`, `/account/subscription`, `/admin`.
  - File bytes: `classifyReportKey` + `getEntitlement()` in `/api/report/[...key]`.
  - Server actions: `auth()` / `currentUser()` / `requireAdmin()`.
  - MCP Pro tool: `experimental_withMcpAuth` + Clerk OAuth.

## Entitlement derivation (the real gate)

`lib/access.ts` `computeEntitlement(meta, email, adminEmails)` (pure, unit-tested) is wrapped by `lib/entitlements.ts` `getEntitlement()` which calls Clerk `currentUser()`:

- `signedIn` — has a Clerk session.
- `billingActive` — `meta.subscribed === true` (set by the Lemon Squeezy webhook).
- `admin` — Clerk role `"admin"` OR email in `ADMIN_EMAILS` (lowercased allowlist).
- `subscribed` (Pro access) — `billingActive || (admin && meta.adminTier !== "free")`.
- Also surfaces `subscriptionId`, `portalUrl`, `subStatus`, `planName`, `renewsAt`, `endsAt` (mirrored from Lemon Squeezy by the webhook, all public-safe).

The MCP server does not use `getEntitlement()` (no request cookies in a tool call); it re-derives the same result from `clerkClient().users.getUser(userId)` + `computeEntitlement`. See `../mcp/auth.md`.

## Clerk-hosted routes

`/sign-in` and `/sign-up` are catch-all (`[[...]]`) so Clerk can render multi-step flows (verification, SSO callbacks) under one path. `AppFrame` strips the site header/footer on these routes. OAuth discovery for MCP is proxied from Clerk via the two `/.well-known/oauth-*` routes.

## Security notes

- The `matcher` includes API routes so authenticated handlers have Clerk context; public REST/MCP endpoints simply don't read it.
- Because gating is downstream of the proxy, a route that forgets to check entitlement would be open — the report route, server actions and MCP Pro tool each implement their own check (defence in depth, mirrored by `tests/access.test.ts`, `tests/api-entitlement.test.ts`, `tests/sec-*`).

## Related docs

- `backend-overview.md` — the access model summary.
- `../auth/` (owned elsewhere) — Clerk configuration.
- `api-routes.md` — per-route auth.
- `../api/auth.md`, `../mcp/auth.md`.
