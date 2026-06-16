# Billing — Overview

## Provider: Lemon Squeezy (Merchant of Record)

AssetFrame sells a single Pro subscription through **Lemon Squeezy**, which acts as the **Merchant of Record** — Lemon Squeezy handles checkout, payment, tax/VAT, invoicing, and the hosted customer portal. AssetFrame never touches card data; the app only:

1. Builds a checkout URL bound to the signed-in Clerk account (`lib/checkout-actions.ts`).
2. Receives Lemon Squeezy **webhooks** to grant/revoke Pro (`app/api/webhooks/lemonsqueezy/route.ts`).
3. Optionally calls the LS API to cancel/resume a subscription (`lib/lemonsqueezy.ts`).

There is **no** local store of money, prices, or cards. Pro access is a boolean (`subscribed`) on the Clerk user's `publicMetadata`, with a durable subscription→user mapping in Postgres (`billing_subscriptions`).

## The flow end to end

```
User (signed in)
  └─ getCheckoutUrl()  ──>  LS hosted checkout (with signed token binding the account)
                                   │  payment
                                   ▼
                          LS subscription webhook  ──>  /api/webhooks/lemonsqueezy
                                   │  HMAC verify, resolve account, map status→bool
                                   ▼
                          Clerk publicMetadata.subscribed = true   +   billing_subscriptions row
                                   │
                                   ▼
                          getEntitlement().subscribed === true  ──>  Pro report files unlock
```

## Checkout URL binding

`getCheckoutUrl()` (`lib/checkout-actions.ts`, a `"use server"` action):

- Reads the base buy link from `SITE.checkoutUrl` (`NEXT_PUBLIC_CHECKOUT_URL`). Empty ⇒ `{ url: null, reason: "unconfigured" }`.
- **Guards** (authoritative, server-side): `!signedIn` → `signed-out`; `admin` → `admin` (comped, must never create a paid sub); `billingActive` → `already-subscribed`.
- Appends `checkout[custom][token]` = a **signed checkout token** (`signCheckoutToken(user.id)`) so the webhook can credit *exactly that Clerk account* regardless of the email typed at checkout.
- Appends `checkout[email]` as a **prefill only** (UX); the signed token is authoritative.

The signing happens server-side so the secret never reaches the client. See [../security/auth-boundaries.md](../security/auth-boundaries.md).

## Pricing

- `NEXT_PUBLIC_PRO_PRICE` (e.g. `£9.99/month`) is display copy and **must match** the Lemon Squeezy variant price — it is not enforced anywhere in code.
- `LEMONSQUEEZY_VARIANT_IDS` (optional) is an allow-list of variant ids that may grant Pro; empty = allow all (single-product MVP default).

## Customer portal / self-service

- `NEXT_PUBLIC_LEMON_PORTAL_URL` (defaults to `https://app.lemonsqueezy.com/my-orders`) and the per-subscription `portalUrl` mirrored from the webhook (`attrs.urls.customer_portal`) let users manage billing in LS's hosted portal.
- In-app cancel/resume is available **only** when `LEMONSQUEEZY_API_KEY` is set (`cancelLemonSubscription` / `resumeLemonSubscription`); otherwise the UI falls back to the hosted portal.

## Env vars

| Var | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CHECKOUT_URL` | public | LS buy link |
| `NEXT_PUBLIC_PRO_PRICE` | public | display price |
| `NEXT_PUBLIC_LEMON_PORTAL_URL` | public | portal link (optional) |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | server | HMAC verify of webhooks |
| `LEMONSQUEEZY_API_KEY` | server | in-app cancel/resume (optional) |
| `LEMONSQUEEZY_VARIANT_IDS` | server | variant allow-list (optional) |
| `CHECKOUT_TOKEN_SECRET` | server | signs the checkout→account token (falls back to `CLERK_SECRET_KEY`) |

## Related docs

- [lemon-squeezy.md](./lemon-squeezy.md) · [webhooks.md](./webhooks.md) · [subscription-lifecycle.md](./subscription-lifecycle.md) · [entitlements.md](./entitlements.md)
