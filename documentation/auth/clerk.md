# Auth — Clerk integration

## Package & version

`@clerk/nextjs@^7.5.2` ("Clerk 7"). Also present: `@clerk/mcp-tools@^0.5.0` (used by the MCP server's OAuth-gated Pro tool).

## `proxy.ts` (not `middleware.ts`)

This app runs a Next.js version where the `middleware` convention was renamed to **`proxy`**. Clerk's auth context is attached in `web/proxy.ts`:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
export default clerkMiddleware();
export const config = {
  matcher: ["/((?!_next|.*\\.[^/]+$).*)", "/(api|trpc)(.*)"],
};
```

- `clerkMiddleware()` runs on every route except Next internals (`_next`) and static files (anything with a file extension), **and** explicitly includes API/trpc routes.
- It attaches session context so server components and route handlers can call `auth()` / `currentUser()`.
- **Important:** the proxy does **not** gate report files. The matcher comment states this explicitly: every report (free + Pro) is private in R2 and served only through the auth-gated `/api/report` route, so there is no public/static report path to protect here.

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\proxy.ts`

## Server-side primitives used

- `currentUser()` — `lib/entitlements.ts`, `lib/checkout-actions.ts`, `app/api/webhooks/clerk/route.ts` (indirectly). Returns the full user incl. `publicMetadata` and `emailAddresses`.
- `auth()` — `lib/push-actions.ts` (`{ userId }`), and elsewhere for lightweight session checks.
- `clerkClient()` — server admin client: `users.getUser`, `users.getUserList`, `users.updateUserMetadata`. Used by the Lemon Squeezy webhook to resolve and update accounts, and by the new-editions cron to look up follower emails.

## Two instances: dev vs prod

| | Development instance | Production instance |
| --- | --- | --- |
| Keys | `pk_test_…` / `sk_test_…` | live `pk_live_…` / `sk_live_…` |
| Used by | local dev, Vercel **preview** deploys (`development` git branch) | production (`main` git branch) |
| Domain | Clerk dev domain | domain-locked to `assetframe.co.uk` (`clerk.assetframe.co.uk`) |

`.env.example` ships the test-key placeholders. The production keys are set in Vercel's Production environment only. The CSP in `next.config.ts` allow-lists both Clerk's dev domains (`*.clerk.accounts.dev`, `*.clerk.com`) and the production custom domain (`clerk.assetframe.co.uk`) for `script-src`, `connect-src`, `frame-src`, and `form-action`.

## Env vars

| Var | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | public | client SDK |
| `CLERK_SECRET_KEY` | server | server SDK / `clerkClient()`; also the default secret for the checkout-binding token |
| `CLERK_WEBHOOK_SECRET` | server | verifies the Clerk `user.deleted` webhook (Svix) |
| `ADMIN_EMAILS` | server | comma-separated admin allowlist |

## Account deletion flow

When a user deletes their Clerk account, Clerk sends a `user.deleted` webhook to `/api/webhooks/clerk`. The handler cancels any Lemon Squeezy subscription bound to that user (via `billing_subscriptions`) so they stop being billed, then cleans up the mapping. See [../billing/subscription-lifecycle.md](../billing/subscription-lifecycle.md). Admin access via `ADMIN_EMAILS` survives deletion: re-signing-up with the same email restores it, so you can never permanently lock yourself out of the dashboard.

## CSP/headers interaction

Clerk widgets, frames, images, telemetry (`clerk-telemetry.com`), and the Cloudflare Turnstile bot-check (`challenges.cloudflare.com`) are all explicitly allow-listed in the enforced CSP. See [../security/csp.md](../security/csp.md).

## Tests

- `tests/clerk-webhook.test.ts` and `tests/sec-webhooks.test.ts` cover Svix signature verification (`lib/clerk-webhook.ts`) — valid signature, missing headers, wrong secret, tampered body, stale/future timestamp, non-numeric timestamp.

## Related docs

- [overview.md](./overview.md) · [roles-and-permissions.md](./roles-and-permissions.md) · [entitlement-checks.md](./entitlement-checks.md)
- [../security/webhook-security.md](../security/webhook-security.md)
