# Forms

Every interactive form in the app is a client component that calls a **server action** (no client-side `fetch` to a custom JSON endpoint, except `ViewBeacon`). Server actions are the write path; see `../backend/server-actions.md` for their guards and DB effects.

## Newsletter — `NewsletterForm.tsx`

- **Action:** `subscribeNewsletter(formData)` (`lib/social-actions.ts`, `"use server"`).
- **Fields:** email (required); hidden honeypot `company` (`tabIndex={-1}`, `aria-hidden`) — any value short-circuits to a fake success (silent spam drop).
- **Flow:** double opt-in. The action upserts a `subscribers` row (`status='pending'`), generates `confirm_token` + `unsub_token`, and emails a confirmation link (`/api/subscribe/confirm?token=...`). UI shows "check your inbox to confirm" / "already subscribed" / error.
- **State:** `useTransition` for pending; result message rendered inline.
- **A11y:** `htmlFor` label, `aria-label` on input.

## Feedback — `app/feedback/FeedbackForm.tsx`

- **Action:** `submitFeedback()` (server action). **Anonymous submissions allowed.**
- **Fields:** message + a category `Select`; hidden honeypot `company`.
- **Flow:** writes to the `feedback` table; resets on success; pending state during submit. Triaged later in `/admin` (`FeedbackInbox`).
- **NOT VERIFIED:** the exact module/signature/guard of `submitFeedback` (the read `lib/feedback.ts` only exposes the read-side `getFeedback`). Behaviour above is from the form + the `feedback` table usage.

## Follow / unfollow — `FollowButton.tsx`, `FollowingList.tsx`

- **Action:** `toggleFollow(symbol, instrument)` (`lib/social-actions.ts`). Requires a Clerk session (the action returns an error if not signed in).
- **Flow:** optimistic UI (`useTransition`); toggles a `watchlists` row; returns `{ ok, following, message? }`. `FollowButton` uses `aria-pressed`; signed-out users get a sign-in link instead.

## Push notifications — `PushToggle.tsx`

- **Actions:** `saveSubscription(sub, ["digest"])` and `removeSubscription(endpoint)` (`lib/push-actions.ts`, both Clerk-guarded).
- **Flow:** reads `Notification.permission`, registers the service worker, subscribes via `PushManager`, persists to `push_subscriptions`. Five UI states (loading/unsupported/blocked/enabled/disabled). Hidden/disabled when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset.

## Checkout — `BuyButton.tsx`

- **Action:** `getCheckoutUrl()` (`lib/checkout-actions.ts`). Returns a signed Lemon Squeezy URL (or a `reason` when admin / already-subscribed / signed-out / unconfigured). The button then sets `window.location.href`.

## Subscription cancel / resume — `CancelSubscription.tsx`, `ResumeSubscription.tsx`

- **Actions:** passed in as `onCancel` / `onResume` props from `app/account/subscription/page.tsx` (server actions in `app/account/subscription/actions.ts`). `CancelSubscription` wraps the call in a Radix `AlertDialog` confirm.

## Admin forms

`AdminActions`, `MemberSearch`, `ProToggle`, `AdminTierToggle`, `EditionToggle`, `FeedbackInbox` — all call admin server actions in `app/admin/actions.ts` (each guarded by `requireAdmin()`). See `../website/account-admin.md`.

## Common patterns

- Pending state via `useTransition`; inline success/error messaging.
- Honeypot `company` field on the two public, unauthenticated forms (newsletter, feedback).
- Server actions are the trust boundary — every write re-checks auth/admin server-side regardless of UI state.

## Related docs

- `../backend/server-actions.md` — action-by-action reference (guards, DB, revalidation).
- `components.md`, `ui-patterns.md`.
