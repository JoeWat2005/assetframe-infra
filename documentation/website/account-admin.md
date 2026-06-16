# Account & admin pages

## `/account` (signed-in)

- **File:** `app/account/page.tsx` (server component, `force-dynamic`).
- **Access:** **Signed-in** — `const ent = await getEntitlement(); if (!ent.signedIn) redirect("/sign-in");`
- **Data:** `getEntitlement()`, `auth()` (userId), `getWatchlist(userId)`.
- **Components:** `Hero`, `Btn`, `BuyButton`, `FollowingList` (client), `PushToggle` (client).

Renders, conditioned on entitlement:
- **Admin:** an "Admin access" card (complimentary Pro, link to `/admin`). If `adminTier === "free"` a note says they're previewing the Free tier.
- **Free (non-admin, not subscribed):** an "Upgrade to Pro" card with a `BuyButton`.
- **Subscribed:** no upsell card.
- Always: a Reports card, a Following card (`FollowingList` over `getWatchlist`), and a Notifications card (`PushToggle`).
- A "Manage subscription" link shows when `showManage = !ent.admin || ent.billingActive` (hidden for comped admins with no paid plan).
- A cancellation note appears when `ent.billingActive && ent.subStatus === "cancelled"`, including the access end date (`ent.endsAt`).

## `/account/subscription` (signed-in)

- **File:** `app/account/subscription/page.tsx` (server component, `force-dynamic`).
- **Access:** **Signed-in** — `if (!ent.signedIn) redirect("/sign-in")`.
- **Data:** `getEntitlement()` (plan, status, subscriptionId, portalUrl, planName, renewsAt, endsAt, billingActive, admin), plus `searchParams.welcome`.
- **Components:** `Hero`, `Card` family, `Badge`, `Button`, `Separator`, `BuyButton`, `CancelSubscription`, `ResumeSubscription`.

Three layouts:
1. **Comp-only admin** (admin, no paid plan): a complimentary-access card.
2. **Free user:** upgrade prompt (`BuyButton`).
3. **Paid user:** plan name, status, renewal/cancellation dates.

In-app cancel/resume controls render only when `canManageInApp` (paid + has `subscriptionId` + the Lemon Squeezy API key is configured); otherwise it falls back to the billing-portal link (`SITE.lemonPortalUrl` or the per-subscription `portalUrl`). A post-purchase welcome banner shows when `welcome === "1"`.

### Subscription server actions
`app/account/subscription/actions.ts` (`"use server"`):
- Guarded by `currentUser()` (returns an error result if not signed in).
- Reads the subscription id from `user.publicMetadata.subscriptionId` (never from client input — prevents acting on someone else's subscription).
- Calls `cancelLemonSubscription()` / `resumeLemonSubscription()` (`lib/lemonsqueezy.ts`), optimistically updates Clerk metadata (webhook reconciles shortly after), and `revalidatePath("/account/subscription")`.

See `../backend/server-actions.md`.

## `/admin` (admin only)

- **File:** `app/admin/page.tsx` (server component, `force-dynamic`, `robots: noindex`).
- **Access:** **Admin** —
  ```ts
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  if (!ent.admin) redirect("/account");
  ```
- **Data:** `getAdminStats()` (`lib/admin-stats.ts`), `getAllEditions()`, `getAuditLog()` (`lib/audit.ts`), `getFeedback()` (`lib/feedback.ts`), Clerk (via `getEntitlement` / stats).
- **Components:** KPI cards + charts (TrendChart, ClassBars, SplitDonut), top reports, plus the client tools:
  - `AdminActions` — grant/revoke Pro by email + "Revalidate content".
  - `MemberSearch` — search Clerk members, inline `ProToggle`.
  - `AdminLog` — searchable/paginated audit trail.
  - `ProToggle` / `AdminTierToggle` — per-member Pro toggle and the admin's own Pro/Free preview toggle.
  - `EditionsBrowser` — search/filter editions, with `EditionToggle` to hide/show each (sets `editions.hidden`; R2 files untouched).
  - `FeedbackInbox` — triage feedback status.

### Admin server actions (`app/admin/actions.ts`, `"use server"`)
All guarded by `requireAdmin()` (`if (!ent.admin) throw new Error("Not authorized")`):
- `setPro(email, subscribed)` — toggles Clerk `subscribed`; if revoking a paying subscriber with a `subscriptionId`, cancels their Lemon Squeezy sub and sets `subStatus = "cancelled"`. `revalidateTag("content")`. Logs audit.
- `setMyAdminTier("pro"|"free")` — sets the current admin's `adminTier`. Logs audit.
- `setEditionHidden(id, hidden)` — validates the id, updates `editions.hidden`. `revalidateTag("content")`. Logs audit.
- `revalidateContent()` — `revalidateTag("content")`. Logs audit.
- `setFeedbackStatus(id, status)` — validates status in `[new, triaged, planned, done, declined]`, updates `feedback.status`. Logs audit.
- `searchMembers(query)` — queries Clerk (limit 20), returns `{id, email, subscribed}[]`.

See `account-admin` security notes below and `../backend/server-actions.md`.

## Security notes

- All three pages re-derive entitlement server-side on every request (`force-dynamic`); no client trust.
- Admin status = Clerk role `"admin"` **or** email in the `ADMIN_EMAILS` allowlist (`lib/access.ts` `computeEntitlement`).
- Admin actions defend again at the action layer (`requireAdmin`) — the page redirect is not the only gate.
- `/admin` and `/account` are disallowed in `robots.txt`.

## Related docs

- `pricing.md` — checkout entry.
- `../backend/server-actions.md` — every server action in detail.
- `../auth/` and `../billing/` (owned by other docs) — Clerk + Lemon Squeezy specifics.
