# Billing — Entitlements (how a payment becomes access)

This connects billing to auth. The full auth derivation is in [../auth/roles-and-permissions.md](../auth/roles-and-permissions.md); this page is the billing-side view of the same machinery.

## The two booleans

`computeEntitlement` (`lib/access.ts`) produces two billing-relevant flags:

```ts
billingActive = meta.subscribed === true;                      // real PAID LS subscription
subscribed    = billingActive || (admin && adminTier !== "free"); // Pro ACCESS (incl. comped admins)
```

| Flag | Set by | Means |
| --- | --- | --- |
| `billingActive` | LS webhook writing `publicMetadata.subscribed = true` | a real, paying Lemon Squeezy subscription exists |
| `subscribed` | derived | this user may read Pro content (paid **or** comped admin) |

Admin comps grant `subscribed` but **not** `billingActive`. That's why the checkout guard blocks admins and existing payers separately.

## From webhook to metadata

The Lemon Squeezy webhook is the only thing that sets `publicMetadata.subscribed` for paying users. On each accepted event it merges a patch into the Clerk user's `publicMetadata`:

- `subscribed` (boolean from `subscriptionStateFromEvent`)
- `subscriptionId`, `lsCustomerId`, `portalUrl`, `subStatus`, `planName`, `renewsAt`, `endsAt`, `subUpdatedAt` (when present)

These mirror onto the `Entitlement` (`portalUrl`, `subStatus`, `planName`, `renewsAt`, `endsAt`, etc.) for display in the account UI. They are all public-safe (no card data). See [webhooks.md](./webhooks.md).

## From metadata to access

`getEntitlement()` (`lib/entitlements.ts`) reads the live Clerk user's `publicMetadata` on each request and runs `computeEntitlement`. The report-file route then gates Pro on `ent.subscribed`:

```ts
if (tier === "pro" && !ent.subscribed) return redirect("/pricing");
```

So a payment unlocks Pro the moment the webhook has written `subscribed:true` and the user's next request re-derives the entitlement. There is no caching of the access decision — it's recomputed per request from Clerk. See [../auth/entitlement-checks.md](../auth/entitlement-checks.md) and [../storage/signed-urls.md](../storage/signed-urls.md).

## Checkout guard (don't double-charge / don't charge comps)

`getCheckoutUrl()` refuses to produce a checkout link when:

- `!ent.signedIn` → `signed-out`
- `ent.admin` → `admin` (comped — must never create a paid subscription, even while previewing the free tier)
- `ent.billingActive` → `already-subscribed`

This is the authoritative server-side guard across every entry point (pricing page, reader, account). See [overview.md](./overview.md).

## Revocation paths

`subscribed` flips back to false when:

- the webhook maps a status to `false` (`expired`/`unpaid`/`paused`), or
- a refund/chargeback event forces a revoke, or
- (for comped admins) `adminTier` is set to `"free"` or the admin role is removed.

## Edge cases

- **Email entered at checkout differs from account email** — irrelevant: the signed checkout token binds the subscription to the Clerk user id, not the email.
- **DB down during a webhook** — Clerk metadata still updates (so access is correct), but the durable mapping and idempotency guard are skipped for that event.
- **Admin previewing free** — `subscribed:false`, so the admin sees the free experience and the checkout button is still suppressed (because `admin` is true in the guard).

## Tests

`tests/access.test.ts` (derivation matrix incl. admin free-preview), `tests/api-entitlement.test.ts` (boundary behaviour), `tests/sec-webhooks.test.ts` (status mapping).

## Related docs

- [overview.md](./overview.md) · [webhooks.md](./webhooks.md) · [subscription-lifecycle.md](./subscription-lifecycle.md)
- [../auth/roles-and-permissions.md](../auth/roles-and-permissions.md) · [../auth/entitlement-checks.md](../auth/entitlement-checks.md)
