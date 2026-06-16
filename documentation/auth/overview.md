# Auth — Overview

## Model

AssetFrame uses **Clerk** for all identity (sign-up, sign-in, sessions, user records). The database stores **no users and no passwords** — Clerk is the system of record for accounts, and a user's *entitlement* (free / Pro / admin) is derived from Clerk `publicMetadata` plus an env email allowlist.

Three pieces work together:

1. **Clerk** (`@clerk/nextjs@^7.5.2`) — identity + sessions, attached to every request via `proxy.ts`.
2. **`publicMetadata`** on the Clerk user — mirrors subscription state written by the Lemon Squeezy webhook (`subscribed`, `subscriptionId`, `subStatus`, `planName`, …) and the admin `role`/`adminTier`.
3. **Entitlement derivation** — pure logic in `lib/access.ts` (`computeEntitlement`), wrapped server-side in `lib/entitlements.ts` (`getEntitlement`).

## Two Clerk instances

There are **two Clerk instances**, one per environment:

- **Development instance** — test keys (`pk_test_…` / `sk_test_…`), used by local dev and Vercel **preview** deploys.
- **Production instance** — live keys, domain-locked to `assetframe.co.uk` (CSP allow-lists `https://clerk.assetframe.co.uk`).

The publishable key (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) is client-exposed; the secret key (`CLERK_SECRET_KEY`) is server-only. See [clerk.md](./clerk.md).

## Where auth is enforced

- **Request context:** `proxy.ts` runs `clerkMiddleware()` so server components and route handlers can call `auth()` / `currentUser()`.
- **Report files:** *not* gated in the proxy. Every report (free + Pro) is private in R2 and served only through the auth-gated `/api/report/[...key]` route, which checks entitlement server-side. See [../storage/signed-urls.md](../storage/signed-urls.md).
- **Server actions / API:** each checks `auth()`/`getEntitlement()` itself (e.g. `lib/push-actions.ts`, `lib/checkout-actions.ts`). There is no reliance on client-side gating for access decisions.

## Tiers at a glance

| Tier | How it's determined |
| --- | --- |
| Signed-out | no Clerk session (`SIGNED_OUT`) |
| Signed-in (free) | Clerk session, no subscription, not admin |
| Pro | `publicMetadata.subscribed === true` (paid) **or** admin (comped) |
| Admin | Clerk `role === "admin"` **or** email in `ADMIN_EMAILS` |

Full rules in [roles-and-permissions.md](./roles-and-permissions.md) and [entitlement-checks.md](./entitlement-checks.md).

## Webhooks

- **Lemon Squeezy → Clerk:** the billing webhook writes subscription state into the user's `publicMetadata`. See [../billing/webhooks.md](../billing/webhooks.md).
- **Clerk → Lemon Squeezy:** the Clerk `user.deleted` webhook cancels the user's LS subscription so a deleted account stops being billed. See [../billing/subscription-lifecycle.md](../billing/subscription-lifecycle.md) and [webhook-security](../security/webhook-security.md).

## Related docs

- [clerk.md](./clerk.md) · [roles-and-permissions.md](./roles-and-permissions.md) · [entitlement-checks.md](./entitlement-checks.md)
- [../billing/entitlements.md](../billing/entitlements.md) · [../security/auth-boundaries.md](../security/auth-boundaries.md)
