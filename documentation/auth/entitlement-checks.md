# Auth — Entitlement checks (server-side everywhere)

## Single source of truth

`getEntitlement()` in `lib/entitlements.ts` is the one function that turns the current Clerk session into an `Entitlement`. It is `import "server-only"`, so it can never run on the client.

```ts
export async function getEntitlement(): Promise<Entitlement> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  return computeEntitlement((user.publicMetadata || {}) as PublicMeta, email, ADMIN_EMAILS);
}
```

The actual rules live in the pure `computeEntitlement` (`lib/access.ts`) — see [roles-and-permissions.md](./roles-and-permissions.md). Splitting pure logic from the Clerk lookup is deliberate so the business rules are unit-tested without mocking Clerk.

## Why server-side only

`lib/access.ts` has **no** `"server-only"` and **no** Clerk import (so it's testable/reusable), but `lib/entitlements.ts`, `lib/db.ts`, `lib/r2.ts` all declare `import "server-only"`. Access decisions are made on the server with the verified session and `publicMetadata`; the client never decides whether a request is entitled. The client may *reflect* entitlement for UX, but the gate is always re-checked server-side at the resource.

## The report-file gate (the critical path)

`app/api/report/[...key]/route.ts` is where entitlement actually protects bytes:

1. Join the catch-all into `objectKey`, classify it with `classifyReportKey` → `"public" | "free" | "pro" | null`. `null` ⇒ **400**.
2. If tier is **not** public:
   - `getEntitlement()`. If `!ent.signedIn` → **302 to `/sign-in`** with `redirect_url` set to the current path.
   - If tier is `"pro"` and `!ent.subscribed` → **302 to `/pricing`**.
3. Pro fetches are logged best-effort to `download_log` (deduped per user/report/kind/hour).
4. Mint a short-lived signed R2 URL and **302** to it. `public` previews get a 600s URL + cacheable redirect; gated files get 120s + `private, no-store`.

So: **preview.png is public, free.* requires a session, pro.* requires `subscribed`.** Admins pass the Pro check because `subscribed` includes comped admins (unless `adminTier:"free"`).

## Other server-side gates

| Location | Check | Effect |
| --- | --- | --- |
| `lib/checkout-actions.ts` (`getCheckoutUrl`) | `getEntitlement()`: refuse if `!signedIn` / `admin` / `billingActive` | never start a paid checkout for a comped admin or existing subscriber |
| `lib/push-actions.ts` (`saveSubscription`/`removeSubscription`) | `auth()` → `userId` required; delete scoped to `endpoint AND clerk_user_id` | login required; users only touch their own push rows |
| `app/api/cron/new-editions` | `isAuthorizedCron(req)` (Bearer `CRON_SECRET`, timing-safe) | only Vercel Cron can trigger; fail-closed if no secret |
| Lemon Squeezy webhook | HMAC verify + verified-payer / signed-token resolution | only a signed, payer-matched event grants Pro |
| Admin dashboard / actions | admin entitlement | admin-only mutations (grant/revoke, hide, revalidate) |

> NOT VERIFIED: the exact admin-route guard implementation (admin dashboard pages/actions live outside the five owned doc areas). The `Entitlement.admin` flag is the intended gate; confirm in `app/` admin routes.

## Public REST API / MCP

The public read API (`/api/v1/...`) does not require auth for free Snapshot data, but validates `date`/`slug` with `isValidReportRef` before any lookup (see [../security/input-validation.md](../security/input-validation.md)). The **Pro** MCP tool (`get_pro_report`) is OAuth-gated and resolves Pro keys via `getEditionProKeys` only for an entitled caller.

> NOT VERIFIED: the precise auth wiring of the MCP `get_pro_report` tool (under `app/api/mcp`, outside owned areas). Memory notes it is reached "via /mcp OAuth with a Pro account".

## Tests

- `tests/access.test.ts` — `computeEntitlement` matrix.
- `tests/api-entitlement.test.ts` — entitlement behaviour at the API boundary.
- `tests/api-cron.test.ts` — cron authorization.

## Related docs

- [roles-and-permissions.md](./roles-and-permissions.md) · [../storage/signed-urls.md](../storage/signed-urls.md) · [../security/auth-boundaries.md](../security/auth-boundaries.md)
