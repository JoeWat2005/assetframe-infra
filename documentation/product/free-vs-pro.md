# Free vs Pro

> Part of the AssetFrame `/documentation` vault → `product/`.
> Companion docs: [product-overview.md](./product-overview.md) ·
> [report-types.md](./report-types.md) · [methodology.md](./methodology.md) ·
> [disclaimers.md](./disclaimers.md)
> Sources: `app/pricing/page.tsx` (the `FREE` / `PRO` arrays — authoritative),
> `app/how-it-works/page.tsx`, `app/faq/page.tsx`, `site.config.ts`,
> `.claude/skills/mvp/SKILL.md` step 10.

Every AssetFrame edition is published as a pair: a free **Snapshot** for everyone and a
paid **Pro** report behind a subscription. This page is the tier comparison. The
document-level contents of each report are in [report-types.md](./report-types.md); the
*price-gating mechanism* (how the bytes are actually withheld) is in
[../billing/entitlements.md](../billing/entitlements.md) and
[../storage/signed-urls.md](../storage/signed-urls.md).

## At a glance

| | AssetFrame Snapshot | AssetFrame Pro |
|---|---|---|
| **Price** | Free | `SITE.proPrice` (currently `£9.99/month`), cancel anytime |
| **Length** | One page | 3–6 pages |
| **Audience** | Everyone | Subscribers |
| **Billing** | — | Lemon Squeezy (merchant of record, handles VAT) |
| **Programmatic access** | REST API + MCP free tools (keyless) | Pro report over MCP (`get_pro_report`, OAuth) and the API for subscribers |

`SITE.proPrice` and the checkout URL come from `site.config.ts`
(`NEXT_PUBLIC_PRO_PRICE`, `NEXT_PUBLIC_CHECKOUT_URL`). Billing detail:
[../billing/overview.md](../billing/overview.md).

## What's in the free Snapshot

Verbatim from the `FREE` feature list in `app/pricing/page.tsx`:

- One-page Snapshot per edition
- Status, risk and broad expected range
- One chart with support/resistance
- Three-bullet thesis and broad scenarios
- Risk-window timeline
- Follow instruments + new-edition alerts
- Public track record + REST API & MCP (free tools)

## What Pro adds

Verbatim from the `PRO` feature list in `app/pricing/page.tsx` ("Everything in the
Snapshot, plus:"):

- Plain-English 30-second read + verdict
- Conditional long & short setups with R:R
- Price ladder with distances and key-level cards
- Calibrated confidence score (0–100), explained
- Registered predictions with explicit windows
- Scenario matrix, event-risk timeline, technicals
- Sentiment, positioning and options context where sourced
- Trade-quality scorecard and risk math
- Full scored outcome ledger + calibration detail
- Pro reports over MCP (OAuth) and the API
- Source audit + glossary of every chart abbreviation

## The hard line between the tiers (QA-enforced)

The free/Pro boundary is not just an editorial convention — it is enforced by the
generation engine's QA gate so Pro-only content can never leak into the free Snapshot:

- The Snapshot **excludes** entries, invalidation logic, R:R, sizing math, options ideas,
  the scorecard, the source audit, the ledger and the price ladder (`mvp_report.py` QA
  gate; SKILL.md step 10).
- `scaffold_payload.py`'s `_assert_free_split` **rejects** pro-only vocabulary (r:r, entry
  zone, invalidation, t1/t2, ladder, source audit, outcome ledger, hedging, risk math)
  leaking into the brief's `free_*` fields (SKILL.md "Language and banned-wording rules").
- The Free teaser and disclaimer fields are the *only* exemption from the free-split scan
  (the teaser legitimately names Pro features to sell the upgrade).

The same free/Pro split is mirrored everywhere the content is exposed:

- **Reader** (`/reports/[date]/[slug]`): a signed-out visitor sees the instrument header +
  bias + a sign-up gate; a signed-in free user sees the Snapshot + a Pro upsell; a
  `subscribed` user also gets Pro download links. The file bytes are gated again at the API
  layer. See [../website/reports-page.md](../website/reports-page.md).
- **Track record** (`/track-record`): signed-out/free users see the **public accuracy
  headline** only; the full open-calls list, scored results and analytics are **Pro-only**.
  See [../website/track-record.md](../website/track-record.md).
- **MCP / API**: `list_reports`, `search_reports`, `get_report`, `get_track_record` are
  keyless; only `get_pro_report` returns the paid analysis and requires OAuth + an active
  Pro subscription. See [../mcp/overview.md](../mcp/overview.md).

## Pro entitlement, billing and cancellation

- **How access is granted:** the Lemon Squeezy webhook (`/api/webhooks/lemonsqueezy`),
  verified timing-safe, flips the buyer's Clerk account to Pro (matched by email). The
  app reads entitlement from Clerk `publicMetadata`. See
  [../billing/webhooks.md](../billing/webhooks.md) and
  [../billing/entitlements.md](../billing/entitlements.md).
- **Cancellation:** one click from `/account/subscription` (Lemon Squeezy API with a
  universal customer-portal fallback); access continues to the end of the paid period
  (`app/faq/page.tsx`). See [../billing/subscription-lifecycle.md](../billing/subscription-lifecycle.md).
- **Admin comp:** an admin (`publicMetadata.role === "admin"` or an `ADMIN_EMAILS` match)
  is treated as entitled without a paid subscription. See
  [../auth/roles-and-permissions.md](../auth/roles-and-permissions.md).

## Disclaimer applies to both tiers

The disclaimer in `SITE.disclaimer` is carried on every report and every page, free or
paid: AssetFrame is general research and decision support, not advice, never tells anyone
to buy or sell, and places no trades. See [disclaimers.md](./disclaimers.md).
