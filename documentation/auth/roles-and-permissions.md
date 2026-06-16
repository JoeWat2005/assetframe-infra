# Auth — Roles and permissions

The three roles (free / Pro / admin) are **derived**, not stored as a single field. Derivation is pure and lives in `lib/access.ts` (`computeEntitlement`); the server wrapper is `lib/entitlements.ts` (`getEntitlement`).

Files:
- `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\access.ts` (pure logic, unit-tested)
- `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\entitlements.ts` (Clerk lookup)

## The `Entitlement` shape

```ts
type Entitlement = {
  signedIn: boolean;
  subscribed: boolean;     // has Pro access (real subscription OR admin comp)
  billingActive: boolean;  // has a REAL paid Lemon Squeezy subscription (not admin comp)
  admin: boolean;
  email?: string;
  adminTier?: "pro" | "free";
  subscriptionId?: string; lsCustomerId?: string; portalUrl?: string;
  subStatus?: string; planName?: string; renewsAt?: string; endsAt?: string;
};
```

`SIGNED_OUT` is the constant for no session: `{ signedIn:false, subscribed:false, billingActive:false, admin:false }`.

## Derivation rules (`computeEntitlement`)

Given the user's `publicMetadata`, their lowercased primary email, and the lowercased `ADMIN_EMAILS` list:

```ts
admin         = meta.role === "admin" || (email && adminEmails.includes(email));
billingActive = meta.subscribed === true;
subscribed    = billingActive || (admin && meta.adminTier !== "free");
```

- **admin** — true if the Clerk `role` is `"admin"` **or** the verified primary email is in the env allowlist. The email allowlist exists so you can grant yourself admin before wiring Clerk roles/metadata.
- **billingActive** — true only for a *real, paid* Lemon Squeezy subscription (the webhook sets `meta.subscribed`). Admin comps do **not** set this.
- **subscribed (= Pro access)** — true if `billingActive`, **or** if you're an admin who hasn't toggled into the free preview.

## `adminTier` — admin free-tier preview

Admins implicitly get Pro. `adminTier: "free"` lets an admin preview the **free** tier without paying: when set, `subscribed` becomes false (no Pro) even though `admin` stays true. This is why the distinction between `subscribed` and `billingActive` matters — an admin previewing free is `admin:true, subscribed:false, billingActive:false`.

## `billingActive` vs `subscribed` — why both exist

| Use | Field |
| --- | --- |
| "Can this request read a Pro report?" | `subscribed` (admins included) |
| "Should we offer a Subscribe button / is there a real paid sub?" | `billingActive` (admins excluded) |

The checkout guard (`lib/checkout-actions.ts`) uses **both**: it refuses to start a checkout if `ent.admin` (admins are comped — must never create a paid sub) **or** `ent.billingActive` (already paying). See [../billing/overview.md](../billing/overview.md).

## `ADMIN_EMAILS`

```ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
```

- Parsed once in `lib/entitlements.ts`, already lowercased; `computeEntitlement` compares against the lowercased email.
- An admin via `ADMIN_EMAILS` survives account deletion: re-signing-up with the same email restores admin (documented in the Clerk webhook handler).

## Permission matrix

| Capability | Signed-out | Free | Pro (paid) | Admin |
| --- | --- | --- | --- | --- |
| View public pages / previews | ✓ | ✓ | ✓ | ✓ |
| Read free report files | redirect to sign-in | ✓ | ✓ | ✓ |
| Read Pro report files | → sign-in | → /pricing | ✓ | ✓ (unless `adminTier:"free"`) |
| Start a paid checkout | → sign-in | ✓ | blocked (already-subscribed) | blocked (comped) |
| Follow instruments / push subscribe | login required | ✓ | ✓ | ✓ |
| Admin dashboard, audit log, grant/revoke, revalidate, hide editions | ✗ | ✗ | ✗ | ✓ |

(Report-file gating is enforced in `app/api/report/[...key]/route.ts`; see [entitlement-checks.md](./entitlement-checks.md).)

## Where roles/metadata are written

- **`subscribed`, `subscriptionId`, `subStatus`, `planName`, `renewsAt`, `endsAt`, `lsCustomerId`, `portalUrl`** — written into `publicMetadata` by the Lemon Squeezy webhook.
- **`role: "admin"`, `adminTier`** — set in the Clerk dashboard / admin tooling. `ADMIN_EMAILS` is the env-based bootstrap path.

## Tests

`tests/access.test.ts` covers `computeEntitlement`: admin-by-role, admin-by-email, paid subscriber, admin free-preview (`adminTier:"free"` ⇒ not subscribed), and signed-out.

## Related docs

- [entitlement-checks.md](./entitlement-checks.md) · [overview.md](./overview.md) · [../billing/entitlements.md](../billing/entitlements.md)
