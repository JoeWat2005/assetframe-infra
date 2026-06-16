# Billing — Webhooks

Two webhooks touch billing. Both verify signatures and both write to the database / Clerk.

- **Lemon Squeezy → app:** `app/api/webhooks/lemonsqueezy/route.ts` — grants/revokes Pro.
- **Clerk → app:** `app/api/webhooks/clerk/route.ts` — cancels LS subscriptions when an account is deleted (covered in [subscription-lifecycle.md](./subscription-lifecycle.md)).

Both routes are `export const dynamic = "force-dynamic"`.

## Lemon Squeezy webhook — step by step

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\app\api\webhooks\lemonsqueezy\route.ts`

The handler's own docstring summarises the contract:

1. **Verify the HMAC** over the **raw** body (`verifyLemonSignature(raw, X-Signature, LEMONSQUEEZY_WEBHOOK_SECRET)`). Fail → **401**. The body is read with `req.text()` *before* JSON parsing so the exact signed bytes are hashed.
2. **Parse**; bad JSON → **400**.
3. **Map** `event_name` + `attrs.status` → `subscribed` via `subscriptionStateFromEvent`. `null` ⇒ `{ ok:true, ignored:true }` (irrelevant event).
4. **Product allow-list:** if `LEMONSQUEEZY_VARIANT_IDS` is set and the event's `variant_id` isn't in it → `{ ok:true, ignored:true, reason:"other-product" }`.
5. **Build the metadata patch** (`subscribed` plus, when present: `subscriptionId`, `lsCustomerId`, `portalUrl`, `subStatus`, `planName`, `renewsAt`, `endsAt`, `subUpdatedAt`).
6. **Resolve the account** (see below).
7. **Idempotency / out-of-order guard** (see below).
8. **Apply:** `clerkClient().users.updateUserMetadata`, upsert `billing_subscriptions`, write `admin_audit_log`. Return `{ ok:true, updated:1, subscribed }`. Any thrown error → **500**.

## Account resolution (3 strategies, in order)

The webhook must map an event to the *right* Clerk user, and must keep working for later events (revokes/refunds) even after the user changes their email. Strategies, in priority order:

1. **Durable mapping (authoritative for every later event).** Look up `billing_subscriptions` by `subscription_id`; if found, use its `clerk_user_id`. This is why revokes/refunds resolve correctly post-email-change.
2. **Signed checkout token.** `verifyCheckoutToken(meta.custom_data.token)` → the authenticated Clerk user id we bound at checkout. Binds directly, **no email match needed** — this is what makes the email entered at checkout irrelevant.
3. **Verified payer email (first grant fallback).** Match `attrs.user_email` against a Clerk user whose **verified primary email equals the payer email** (`isVerifiedPayer`). A `custom_data.user_id` *hint* is only honoured if that user also passes `isVerifiedPayer`. This blocks granting Pro to an arbitrary/victim account via a forged `user_id`.

If none resolve, the event is logged as `grant_unresolved` / `revoke_unresolved` and returns `{ ok:true, ignored:true, reason:"no-account" }`. Unresolved **revokes** are the residual fail-open risk and are logged so they're recoverable, never silently dropped.

## HMAC verify — timing-safe

`verifyLemonSignature` does `crypto.createHmac("sha256", secret).update(rawBody).digest("hex")`, then a **length check + `crypto.timingSafeEqual`**. No secret or no signature ⇒ false. A wrong-length signature returns false without throwing. See [../security/webhook-security.md](../security/webhook-security.md).

## Idempotency & out-of-order protection

`billing_subscriptions.updated_at` stores the LS event `updated_at` (ISO string) of the **last applied** event for that subscription. On each event, if there's a mapping and `eventAt <= mappedUpdatedAt`, the handler returns `{ ok:true, skipped:"stale" }` — it never applies an older or replayed event over a newer state. The upsert uses `COALESCE(excluded.updated_at, billing_subscriptions.updated_at)` so a missing timestamp doesn't wipe the stored one.

## `billing_subscriptions` mapping write

```sql
INSERT INTO billing_subscriptions (subscription_id, ls_customer_id, clerk_user_id, status, updated_at)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (subscription_id) DO UPDATE SET
  ls_customer_id = COALESCE(excluded.ls_customer_id, billing_subscriptions.ls_customer_id),
  clerk_user_id  = excluded.clerk_user_id,
  status         = excluded.status,
  updated_at     = COALESCE(excluded.updated_at, billing_subscriptions.updated_at);
```

Mapping persistence is best-effort (wrapped in try/catch). If the table isn't migrated yet, the handler still falls back to email binding (the lookup catch comments "table not migrated yet → fall back").

## Refund / chargeback revoke

`subscription_payment_refunded` forces `subscribed = false` regardless of the status field, so Pro is pulled even if the subscription momentarily still reads `active`. The resulting metadata patch + audit log record the revoke.

## Audit trail

Every applied event writes an `admin_audit_log` row: `actor:"webhook"`, `action: subscribed ? "billing_grant" : "billing_revoke"`, `target`: the user's primary email (or payer email / user id), `detail`: `"<event> status=<status> sub=<id>"`. Unresolved events write `grant_unresolved` / `revoke_unresolved`. See [../database/tables.md](../database/tables.md).

## Idempotency vs Clerk metadata

The metadata update merges into existing `publicMetadata` (`{ ...user.publicMetadata, ...patch }`), so unrelated metadata is preserved.

## Tests

`tests/sec-webhooks.test.ts` + `tests/lemonsqueezy.test.ts`: signature rejection paths and the full status→bool mapping (incl. refund-always-revokes and null-for-unrelated). Account resolution and idempotency are exercised through the route-level entitlement tests.

## Related docs

- [lemon-squeezy.md](./lemon-squeezy.md) · [subscription-lifecycle.md](./subscription-lifecycle.md) · [entitlements.md](./entitlements.md)
- [../security/webhook-security.md](../security/webhook-security.md) · [../database/tables.md](../database/tables.md)
