# Security — Webhook security

Two webhooks can change paid access, so both are hardened against unsigned, mis-signed, replayed, and tampered payloads. Both read the **raw** request body before parsing so the exact signed bytes are verified.

## Lemon Squeezy webhook

Route: `app/api/webhooks/lemonsqueezy/route.ts` · Verifier: `lib/lemonsqueezy.ts` (`verifyLemonSignature`).

### Signature verification
- HMAC-**SHA256** of the raw body with `LEMONSQUEEZY_WEBHOOK_SECRET`, hex digest.
- Compared with `crypto.timingSafeEqual` **after a length check** (timingSafeEqual throws on length mismatch, so the length guard is required and also avoids leaking length via timing).
- Missing signature, missing secret, wrong secret, tampered body, or wrong-length signature all return **false** -> route responds **401**. A malformed signature does **not** throw.

### Account-binding hardening
A valid signature proves the event came from Lemon Squeezy, but not *which* account to credit. Binding is hardened so an attacker can't redirect Pro to a victim:
1. **Durable mapping** (`billing_subscriptions` by `subscription_id`) — authoritative for all later events.
2. **Our signed checkout token** (`verifyCheckoutToken`) — HMAC token we minted for the authenticated Clerk user; binds directly.
3. **Verified payer email** — falls back to a Clerk user whose **verified** primary email equals the payer email (`isVerifiedPayer`). A `custom_data.user_id` hint is honoured **only** if that user also passes `isVerifiedPayer`. This blocks granting Pro to an arbitrary account via a forged `user_id`.

Unresolved events are logged (`grant_unresolved` / `revoke_unresolved`) rather than silently dropped.

### Replay / out-of-order
`billing_subscriptions.updated_at` holds the last-applied LS `updated_at`. Events with `eventAt <= mappedUpdatedAt` are skipped (`skipped:"stale"`), so a replayed old "active" can't un-revoke a later "expired". See [../billing/webhooks.md](../billing/webhooks.md).

### Refund safety
`subscription_payment_refunded` forces revoke regardless of reported status — a refund/chargeback always pulls Pro.

## Clerk webhook (Svix)

Route: `app/api/webhooks/clerk/route.ts` · Verifier: `lib/clerk-webhook.ts` (`verifyClerkWebhook`).

### Signature verification
- Svix scheme: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}` using the base64-decoded secret (after stripping the `whsec_` prefix), base64 digest.
- The `svix-signature` header is space-separated `v1,<sig>` entries; each is compared **timing-safe** (length check + `timingSafeEqual`); any match passes.
- Missing headers, missing secret, wrong secret, or tampered body -> **false** -> **401**.

### Replay window
Rejects when the `svix-timestamp` is more than **300 seconds** (5 min) from now, in either direction (stale **or** future). A non-numeric timestamp returns false without throwing.

### What it does
Only acts on `user.deleted`: cancels the user's LS subscriptions (cancel-at-period-end) and cleans up the mapping **only on a successful cancel**, so a failed cancel stays visible in the audit log and can't keep billing a deleted user. See [../billing/subscription-lifecycle.md](../billing/subscription-lifecycle.md).

## Shared properties

- Raw-body-first (`req.text()`), then JSON parse; bad JSON -> **400**.
- Both routes `export const dynamic = "force-dynamic"`.
- Both write `admin_audit_log` rows for grants/revokes/cancels (best-effort).
- Secrets are server-only env vars; never client-exposed.

## Backlog

- **No rate limiting** on the webhook endpoints (or any `/api/*`). A flood of bad-signature requests is rejected cheaply (length check short-circuits), but there is no Firewall/Upstash throttle. Tracked as backlog. See [threat-model.md](./threat-model.md).

## Tests

`tests/sec-webhooks.test.ts` (security-focused) + `tests/lemonsqueezy.test.ts` + `tests/clerk-webhook.test.ts`:
- LS: genuine HMAC accepted; missing/empty/wrong-secret/tampered/malformed-length signature rejected (no throw); full status->bool mapping incl. refund-always-revokes and null-for-unrelated.
- Clerk: correctly-signed fresh webhook accepted; missing headers, unset secret, tampered body, wrong secret, stale (>5min) and future timestamps, and non-numeric timestamp all rejected without throwing.

## Related docs

- [../billing/webhooks.md](../billing/webhooks.md) · [../billing/subscription-lifecycle.md](../billing/subscription-lifecycle.md) · [auth-boundaries.md](./auth-boundaries.md) · [../auth/clerk.md](../auth/clerk.md)
