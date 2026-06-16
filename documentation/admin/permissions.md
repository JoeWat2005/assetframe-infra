# Admin permissions

Who counts as an admin, how it is enforced, and how an admin's view differs from a member's. The logic is the pure function `computeEntitlement` (`lib/access.ts`), wrapped for Clerk by `getEntitlement` (`lib/entitlements.ts`), and exhaustively tested in `tests/api-entitlement.test.ts` + `tests/access.test.ts`.

## Who is an admin

A signed-in user is an admin if **either**:

1. Their Clerk `publicMetadata.role === "admin"`, **or**
2. Their email is in the `ADMIN_EMAILS` allow-list (env var; comma-separated).

`ADMIN_EMAILS` is lowercased + trimmed at load (`lib/entitlements.ts`) and the caller's email is lowercased before comparison — so matching is **case-insensitive on the email but exact on membership**. `admin@assetframe.co.uk.evil.com` is NOT admin (verified by test). The allow-list exists so you can grant yourself admin before wiring Clerk roles.

## What admin grants

- Access to `/admin`.
- **Comped Pro** on every edition (`subscribed = true`) — but `billingActive = false` because they never paid. So admins read all Pro content for free, and admin comps are correctly excluded from the Pro-subscriber count / MRR.
- The ability to run every admin server action (grant/revoke Pro, hide/restore editions, triage feedback, bust cache).

## The entitlement shape

`computeEntitlement(meta, email, adminEmails)` returns:

| Field | Meaning |
| --- | --- |
| `signedIn` | has a Clerk session |
| `admin` | role==="admin" OR email in allow-list |
| `billingActive` | a real paid Lemon Squeezy sub (`meta.subscribed === true`) |
| `subscribed` (Pro access) | `billingActive` OR (`admin` AND `adminTier !== "free"`) |
| `adminTier` | `"pro"` (default for admins) or `"free"` (admin previewing the free tier) |
| plus mirrored LS fields | `subStatus`, `endsAt`, `renewsAt`, `planName`, `subscriptionId`, `lsCustomerId`, `portalUrl` |

Signed-out users get the shared `SIGNED_OUT` constant (everything false).

## Admin preview tier

Admins get Pro by default. On `/admin`, the **Preview tier** toggle (`AdminTierToggle` -> `setMyAdminTier`) sets `adminTier`:
- `free` -> the admin sees the non-subscriber product (`subscribed` drops to false) but **keeps** `admin` (still reaches `/admin`).
- A **real paid subscription overrides** `adminTier: "free"` — a paying admin stays Pro even while previewing free (verified by test).

## Privilege-escalation guards (tested)

- A free user **cannot** self-grant admin by putting `adminTier` in their own metadata — `adminTier` is inert unless the user is actually an admin.
- A free user **cannot** become admin via a bogus `role` string (only the exact string `"admin"` counts).
- No email + no role = never admin.

## Enforcement: server-side, always

UI gating is never the only gate:

- **Pages:** `/admin` (`app/admin/page.tsx`) redirects non-admins; `/account` redirects signed-out users.
- **Server actions:** every action in `app/admin/actions.ts` calls `requireAdmin()` (which throws if `!ent.admin`) before doing anything. They also validate inputs (edition id and feedback id regex-checked, feedback status whitelisted, email format checked).
- **Report files:** `app/api/report/[...key]/route.ts` checks `ent.subscribed` for Pro before signing a URL.
- **noindex:** `/admin` sets `robots: { index:false, follow:false }` so it never appears in search/AI indexes; `robots.ts` also disallows `/admin` and `/account` for all crawlers.

## Granting admin to someone

1. Quick: add their email to `ADMIN_EMAILS` (env) and redeploy.
2. Durable: set `publicMetadata.role = "admin"` on their Clerk user (Clerk dashboard). This survives env changes and is the preferred long-term path.

Refunds, bans, and role management beyond this live in the Clerk + Lemon Squeezy dashboards (see `admin-panel.md`).

## Related docs

- `admin-panel.md`, `maintenance.md`.
- `../auth/`, `../billing/` (owned elsewhere), `../testing/security-tests.md` (the entitlement + escalation tests).
