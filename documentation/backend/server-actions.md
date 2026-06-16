# Server actions

Modules marked `"use server"` expose functions callable directly from client components. Each is its own trust boundary: it re-checks auth/admin server-side regardless of UI state. The forms that call them are in `../frontend/forms.md`.

## Social — `lib/social-actions.ts`

### `toggleFollow(symbol, instrument)`
- **Guard:** `auth()`; returns early (error) if no `userId`.
- **DB:** `watchlists` — SELECT existing, DELETE if present else INSERT.
- **Returns:** `{ ok, following, message? }` (the resulting state).

### `subscribeNewsletter(formData)`
- **Guard:** none (anonymous allowed); optionally associates the signed-in `userId`.
- **Honeypot:** any value in `company` -> fake success.
- **Validation:** email contains `@`, length < 200.
- **DB:** upsert `subscribers` (`status='pending'`, fresh `confirm_token` + `unsub_token` via `randomUUID`).
- **Email:** `sendEmail()` with a `/api/subscribe/confirm?token=...` link (double opt-in). Succeeds even if email send fails.
- **Returns:** `{ ok, message }`.

## Push — `lib/push-actions.ts`

### `saveSubscription(sub, topics = [])`
- **Guard:** `auth()`; early return if no `userId`.
- **DB:** upsert `push_subscriptions` by endpoint (`clerk_user_id`, `endpoint`, `p256dh`, `auth`, `topics`, `last_seen_at`).
- **Returns:** `{ ok, message? }`.

### `removeSubscription(endpoint)`
- **Guard:** `auth()`.
- **DB:** DELETE from `push_subscriptions` by `endpoint` **and** `clerk_user_id` (scoped to caller).
- **Returns:** `{ ok, message? }`.

## Checkout — `lib/checkout-actions.ts`

### `getCheckoutUrl()`
- **Guard:** `currentUser()` + `getEntitlement()`.
- **Logic:** returns `reason` `"admin"` (admin), `"already-subscribed"` (`billingActive`), `"signed-out"` (not signed in), or `"unconfigured"`; otherwise returns the Lemon Squeezy checkout URL with a signed token (`signCheckoutToken(userId)`, `lib/checkout-token.ts`, HMAC-SHA256, 1h TTL).
- **Mutations:** none.
- **Returns:** `{ url: string | null, reason? }`.

## Subscription — `app/account/subscription/actions.ts`

`cancel` / `resume` actions (passed to `CancelSubscription` / `ResumeSubscription`):
- **Guard:** `currentUser()`; error if not signed in.
- Reads the subscription id from `user.publicMetadata.subscriptionId` — **never from client input**.
- Calls `cancelLemonSubscription()` / `resumeLemonSubscription()` (`lib/lemonsqueezy.ts`), optimistically updates Clerk metadata (the webhook reconciles shortly after), and `revalidatePath("/account/subscription")`.
- **Returns:** a `{ ok, ... }` result.

## Admin — `app/admin/actions.ts`

All guarded by `requireAdmin()` (`const ent = await getEntitlement(); if (!ent.admin) throw new Error("Not authorized")`):

| Action | Mutates | Revalidate | Audit |
|---|---|---|---|
| `setPro(email, subscribed)` | Clerk `subscribed`; if revoking a paying sub with a `subscriptionId`, cancels Lemon Squeezy sub + sets `subStatus="cancelled"` | `revalidateTag("content")` | yes |
| `setMyAdminTier("pro"\|"free")` | current admin's `adminTier` | — | yes |
| `setEditionHidden(id, hidden)` | `editions.hidden` (id validated) | `revalidateTag("content")` | yes (`publish_report`/`unpublish_report`) |
| `revalidateContent()` | cache only | `revalidateTag("content")` | yes |
| `setFeedbackStatus(id, status)` | `feedback.status` (status in `[new,triaged,planned,done,declined]`) | — | yes |
| `searchMembers(query)` | none (reads Clerk, limit 20) | — | — |

Returns are `{ ok, message }` (or member list for `searchMembers`). R2 files are untouched by `setEditionHidden`.

## Feedback submit (public)

`submitFeedback()` is called by `FeedbackForm` to write to the `feedback` table (anonymous allowed, honeypot-guarded).
- **NOT VERIFIED:** the exact module path + signature were not read in full (`lib/feedback.ts` exposes only `getFeedback`). The write path is inferred from the form + the `feedback` table consumed by `getFeedback`/`setFeedbackStatus`.

## Common patterns

- Return objects (`{ ok, message? }`) rather than throwing, except admin guards which throw `"Not authorized"`.
- DB writes degrade silently to a failure result when `sql` is null.
- Mutations that change published content call `revalidateTag("content")`; per-user mutations use `revalidatePath`.

## Related docs

- `../frontend/forms.md` — the calling components.
- `api-routes.md` — webhook reconciliation of subscription state.
- `../billing/`, `../social/` (owned elsewhere).
