# Security — Auth boundaries

Where the app draws trust lines and enforces them. The rule throughout: **access decisions are made server-side**, never on the client.

## Boundary 1 — the report-file gate (`/api/report/[...key]`)

The single door to every report file (free + Pro live in private R2). The route:
1. validates the key (`classifyReportKey`) -> 400 on anything not in the allow-list;
2. for non-public tiers, calls `getEntitlement()`:
   - not signed in -> 302 `/sign-in`;
   - `pro` and not `subscribed` -> 302 `/pricing`;
3. only then signs a short-lived R2 URL and redirects.

There is **no** static/public report path; the proxy explicitly does not gate report files because they're never served outside this route. See [../storage/signed-urls.md](../storage/signed-urls.md) and [../auth/entitlement-checks.md](../auth/entitlement-checks.md).

## Boundary 2 — request auth context (`proxy.ts`)

`clerkMiddleware()` attaches session context on every non-static route (matcher includes `/(api|trpc)(.*)`). This makes `auth()` / `currentUser()` available but is **not itself** an authorization gate — individual routes/actions do the checks. See [../auth/clerk.md](../auth/clerk.md).

## Boundary 3 — server actions (own-resource scoping)

- `lib/checkout-actions.ts` (`getCheckoutUrl`): requires `signedIn`; refuses for `admin` (comped) and `billingActive` (already paying). Server-only signing of the checkout token.
- `lib/push-actions.ts`: `saveSubscription` / `removeSubscription` require `auth().userId`. The delete is scoped `WHERE endpoint = $1 AND clerk_user_id = $2` so a user **cannot delete another user's** push subscription by replaying an endpoint string.

## Boundary 4 — webhooks (verify before trust)

- Lemon Squeezy: HMAC verify of the raw body, then account binding only via the durable mapping, our signed checkout token, or a **verified** payer email.
- Clerk: Svix verify + 5-min timestamp window.

Both reject with 401 on a bad signature. See [webhook-security.md](./webhook-security.md).

## Boundary 5 — the cron endpoint (`/api/cron/new-editions`)

`isAuthorizedCron(req)` (`lib/cron.ts`) requires `Authorization: Bearer <CRON_SECRET>` and compares it **timing-safe** after a length check. **Fail-closed:** if `CRON_SECRET` is unset the function returns false, so the endpoint can never be triggered anonymously in production. Vercel Cron attaches this header automatically (configured in `vercel.json`, `0 7 * * *`).

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\cron.ts`

## Boundary 6 — public REST / MCP

The public read API serves free Snapshot data without auth, but validates `date`/`slug` (`isValidReportRef`) before any query, and the Pro MCP tool is OAuth-gated and resolves Pro keys server-side via `getEditionProKeys`. See [input-validation.md](./input-validation.md).

> NOT VERIFIED: the admin dashboard's route-level guard and the MCP OAuth wiring live outside the owned doc areas (`app/` admin routes, `app/api/mcp`). The intended gates are `Entitlement.admin` and Clerk OAuth respectively; confirm in those routes.

## The two entitlement booleans at the boundary

| Check | Flag | Used for |
| --- | --- | --- |
| read Pro content | `subscribed` (incl. comped admins) | `/api/report` pro tier, Pro MCP tool |
| offer/allow a paid checkout | `billingActive` + `!admin` | `getCheckoutUrl` guard |

See [../auth/roles-and-permissions.md](../auth/roles-and-permissions.md).

## Client never decides

`lib/access.ts` is pure (no Clerk, no `server-only`) so it's testable, but it's only ever *invoked* from `getEntitlement()` (`server-only`) with the verified session. The client may reflect entitlement for UX, but the resource re-checks server-side every time.

## Related docs

- [webhook-security.md](./webhook-security.md) · [input-validation.md](./input-validation.md) · [threat-model.md](./threat-model.md)
- [../auth/entitlement-checks.md](../auth/entitlement-checks.md) · [../storage/signed-urls.md](../storage/signed-urls.md)
