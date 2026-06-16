# Pricing page

- **Route:** `/pricing`
- **File:** `app/pricing/page.tsx` (server component, static — no `dynamic`/`revalidate`).
- **Access:** Public.
- **Data:** `SITE.proPrice`, `SITE.disclaimer`, and two hardcoded feature arrays (`FREE`, `PRO`).
- **Key components:** `Hero`, `Btn`, `Note`, `BuyButton`.

## Content

Two cards side by side:

**AssetFrame Snapshot (Free)** — feature list (`FREE`):
- One-page Snapshot per edition
- Status, risk and broad expected range
- One chart with support/resistance
- Three-bullet thesis and broad scenarios
- Risk-window timeline
- Follow instruments + new-edition alerts
- Public track record + REST API & MCP (free tools)

CTA: `Btn href="/reports"` ("Browse free editions").

**AssetFrame Pro (`SITE.proPrice`, default "£9.99/month")** — feature list (`PRO`) including conditional long/short setups, the price ladder, the calibrated confidence score, registered predictions, scenario matrix, sentiment/positioning where sourced, the trade-quality scorecard, the full scored ledger + calibration detail, **Pro reports over MCP (OAuth) and the API**, and the source audit + glossary.

CTA: `BuyButton` ("Subscribe {price}") + `Btn href="/account"` ("Already subscribed?").

## Checkout

The `BuyButton` is the single entry point to checkout. It is a client component that branches on the viewer's state (subscribed -> manage page; admin -> account; signed-out -> sign-up with `redirect_url=/pricing`; signed-in free -> calls the `getCheckoutUrl()` server action and redirects to the signed Lemon Squeezy URL). Price label and the underlying checkout URL come from `SITE` (`proPrice`, `checkoutUrl`, overridable via `NEXT_PUBLIC_*` env). See `../backend/server-actions.md` (checkout) and `../frontend/components.md` (BuyButton).

The page footer `Note` explains checkout opens in-page, that subscription is bound to the signed-in account, and the one-click cancel + access-to-period-end policy. The `SITE.disclaimer` renders below.

## Edge cases

- The feature lists are static copy — they are the marketing source of truth, not derived from entitlements.
- Actual price billed and gating are enforced server-side via the Lemon Squeezy webhook + `computeEntitlement`, independent of this page's label. See `../backend/api-routes.md` (lemonsqueezy webhook).

## Related docs

- `account-admin.md` — `/account/subscription` manage/cancel/resume.
- `../backend/server-actions.md` — `getCheckoutUrl`, cancel/resume actions.
- `../api/overview.md`, `../mcp/overview.md` — free-vs-Pro programmatic access.
