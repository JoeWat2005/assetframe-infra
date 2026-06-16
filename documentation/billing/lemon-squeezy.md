# Billing — Lemon Squeezy (Merchant of Record)

## Why Merchant of Record matters

Lemon Squeezy is the seller of record: it collects payment, charges/remits sales tax & VAT, issues invoices, and hosts the customer portal. AssetFrame is not a payment processor and stores no PCI data. The integration surface is three things: a checkout link, webhooks, and a thin API client.

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\lemonsqueezy.ts`

## What `lib/lemonsqueezy.ts` provides

### 1. `verifyLemonSignature(rawBody, signature, secret)`
HMAC-SHA256 of the **raw** request body with `LEMONSQUEEZY_WEBHOOK_SECRET`, compared **timing-safe** (`crypto.timingSafeEqual`) after a length check. Returns false for any missing signature/secret. This is the gate that rejects forged/unsigned webhooks. See [webhooks.md](./webhooks.md) and [../security/webhook-security.md](../security/webhook-security.md).

### 2. `subscriptionStateFromEvent(eventName, status)` → `boolean | null`
Maps a webhook to a Pro decision:
- **REVOKE_EVENTS** (`subscription_payment_refunded`) → `false` **always**, regardless of reported status (a refund/chargeback must pull Pro even if the sub momentarily still reads active).
- If the event isn't a known `SUBSCRIPTION_EVENTS` member → `null` (leave access unchanged).
- Otherwise decide by **status** (more reliable than the event name):
  - `ACTIVE_STATUSES` = `active`, `on_trial`, `cancelled`, `past_due` → `true`
  - `INACTIVE_STATUSES` = `expired`, `unpaid`, `paused` → `false`
  - unknown status → `null`

Subscription events handled: `subscription_created`, `_updated`, `_resumed`, `_unpaused`, `_paused`, `_cancelled`, `_expired`, `_payment_success`, `_payment_failed`, `_payment_recovered`, `_plan_changed`. Anything else (e.g. `order_created`) returns `null` and is ignored.

### 3. `cancelLemonSubscription(subscriptionId)` → `CancelResult`
`DELETE /v1/subscriptions/{id}` with `Bearer LEMONSQUEEZY_API_KEY`. In Lemon Squeezy, `DELETE` = **cancel at period end** (non-destructive: the user keeps access until the period runs out). Typed result:
`{ ok:true, status }` or `{ ok:false, reason:"no-api-key"|"no-subscription"|"http-error"|"network" }`. The typed reason lets the UI fall back to the hosted portal when the API key isn't configured. Used by the Clerk `user.deleted` webhook to stop billing a deleted account.

### 4. `resumeLemonSubscription(subscriptionId)` → `CancelResult`
`PATCH /v1/subscriptions/{id}` with body `{ data: { type:"subscriptions", id, attributes:{ cancelled:false } } }` — un-cancels a subscription that was cancelled but hasn't expired yet.

## API specifics

- Base URL: `https://api.lemonsqueezy.com/v1`.
- Headers: `Accept`/`Content-Type: application/vnd.api+json`, `Authorization: Bearer <LEMONSQUEEZY_API_KEY>`.
- Both API calls are wrapped in try/catch and return `{ ok:false, reason:"network" }` on throw — they never throw to the caller.

## Webhook attributes consumed

The webhook route reads these `data.attributes` (`Attrs` type): `user_email`, `status`, `variant_name`, `product_name`, `variant_id`, `product_id`, `customer_id`, `updated_at`, `renews_at`, `ends_at`, `urls.customer_portal`, `urls.update_payment_method`. From `meta`: `event_name`, `custom_data.user_id`, `custom_data.token`.

## Product allow-list

If `LEMONSQUEEZY_VARIANT_IDS` is set, only those `variant_id`s grant Pro (so an unrelated product on the same store can't). Empty/unset = allow all.

## Tests

`tests/lemonsqueezy.test.ts` and `tests/sec-webhooks.test.ts` cover:
- genuine HMAC accepted; missing/empty/wrong-secret/tampered/malformed signature rejected (no throw on bad length);
- status mapping: grant on active/trial/payment-success; keep on cancelled + past_due; revoke on expired/unpaid/paused; **always revoke on refund**; `null` for unrelated events / unknown status.

## Related docs

- [overview.md](./overview.md) · [webhooks.md](./webhooks.md) · [subscription-lifecycle.md](./subscription-lifecycle.md)
