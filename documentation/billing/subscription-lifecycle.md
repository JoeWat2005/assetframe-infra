# Billing — Subscription lifecycle

Access is driven by the **subscription status** that Lemon Squeezy reports on every subscription event, not by guessing from event names. The mapping lives in `subscriptionStateFromEvent` (`lib/lemonsqueezy.ts`).

## Status → access

| LS status | Pro access? | Meaning |
| --- | --- | --- |
| `active` | ✓ keep | paying |
| `on_trial` | ✓ keep | trialing |
| `cancelled` | ✓ keep | cancelled but **not yet expired** — keep access until the period ends |
| `past_due` | ✓ keep | payment retrying (dunning) — keep access during the grace window |
| `expired` | ✗ revoke | period ended after cancel |
| `unpaid` | ✗ revoke | dunning exhausted |
| `paused` | ✗ revoke | subscription paused |
| (refund/chargeback event) | ✗ revoke | forced revoke regardless of status |
| unknown status | — leave unchanged | `null` returned |

The two sets in code:
```ts
ACTIVE_STATUSES   = { active, on_trial, cancelled, past_due }   // → true
INACTIVE_STATUSES = { expired, unpaid, paused }                 // → false
```

## Lifecycle walk-through

1. **Created / first payment** — `subscription_created` / `subscription_payment_success` with `active` (or `on_trial`) → grant Pro. Webhook resolves the account by the signed checkout token, writes `publicMetadata.subscribed=true`, inserts the `billing_subscriptions` mapping, audits `billing_grant`.
2. **Renewal** — `subscription_payment_success` keeps `active` → stays granted.
3. **Failed payment / dunning** — `subscription_payment_failed` with `past_due` → access **kept** during the grace window. `subscription_payment_recovered` returns to `active`.
4. **User cancels** — `subscription_cancelled` with `cancelled` → access **kept** until period end (LS `DELETE` = cancel-at-period-end). The user can `resumeLemonSubscription` while still `cancelled` to un-cancel.
5. **Period ends** — `subscription_expired` with `expired` → **revoke**. `publicMetadata.subscribed=false`, audit `billing_revoke`.
6. **Pause** — `subscription_paused` with `paused` → revoke; `subscription_resumed`/`subscription_unpaused` restore.
7. **Refund / chargeback** — `subscription_payment_refunded` → **revoke immediately**, even if status still reads `active`.

## Out-of-order / replayed events

Webhooks can arrive late or duplicated. The handler compares the event's `updated_at` against the last-applied `updated_at` stored on the `billing_subscriptions` row and **skips** anything not strictly newer (`eventAt <= mappedUpdatedAt` ⇒ `skipped:"stale"`). This prevents a replayed older "active" event from un-revoking a later "expired". See [webhooks.md](./webhooks.md).

## Account deletion (Clerk → Lemon Squeezy)

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\app\api\webhooks\clerk\route.ts`

When a user deletes their Clerk account, Clerk fires `user.deleted`:

1. Verify the Svix signature (`verifyClerkWebhook`, `CLERK_WEBHOOK_SECRET`); bad → 401. Non-`user.deleted` events → ignored.
2. Look up every `billing_subscriptions` row for that `clerk_user_id`.
3. For each, call `cancelLemonSubscription(subId)` (cancel-at-period-end → stops future billing) and audit `billing_cancel_on_delete` (success or a FAILED note telling an admin to cancel manually in Lemon Squeezy).
4. **Only on a successful cancel**, delete the mapping row. A failed cancel (e.g. missing `LEMONSQUEEZY_API_KEY`) **keeps** the row, flagged in the audit log, so it can't quietly keep billing a deleted user.
5. Audit `user_deleted` with the cancelled/failed counts.

Note: admin access via `ADMIN_EMAILS` survives deletion — re-signing-up with the same email restores admin (so deleting an admin account never locks you out of the dashboard).

## State storage

- **Truth for access:** `publicMetadata.subscribed` on the Clerk user (read by `getEntitlement`).
- **Durable mapping + last status/timestamp:** `billing_subscriptions` (`status`, `updated_at`).
- **History:** `admin_audit_log` (grant/revoke/cancel/delete rows).

## Edge cases

- A subscription whose payer email later changes still resolves via the durable mapping or signed token, so revokes/expiries continue to apply correctly.
- If the DB isn't configured, the webhook still updates Clerk metadata (the mapping write is best-effort), but it loses the idempotency guard and the durable-mapping resolution for that event.
- `renews_at`/`ends_at` are mirrored into metadata for display only; access is decided purely by status (+ refund rule).

## Related docs

- [webhooks.md](./webhooks.md) · [lemon-squeezy.md](./lemon-squeezy.md) · [entitlements.md](./entitlements.md) · [../auth/clerk.md](../auth/clerk.md)
