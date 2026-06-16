# Product overview

> Part of the AssetFrame `/documentation` vault → `product/`.
> Companion docs: [free-vs-pro.md](./free-vs-pro.md) · [methodology.md](./methodology.md) ·
> [report-types.md](./report-types.md) · [disclaimers.md](./disclaimers.md)
> Sources: `mvp/README.md`, `site.config.ts`, `app/about/page.tsx`,
> `app/how-it-works/page.tsx`, `app/faq/page.tsx`, `.claude/skills/mvp/SKILL.md`.

## What AssetFrame is

**AssetFrame** publishes pre-session market research and scores it after the fact.
The tagline (`SITE.tagline` in `site.config.ts`) is the whole product in one line:

> **Next-session market intelligence, scored after the fact.**

For every instrument it covers, AssetFrame ships a **two-tier report pair**:

- **AssetFrame Snapshot** — free, one page.
- **AssetFrame Pro** — paid, 3–6 pages (`SITE.proPrice`, currently `£9.99/month`,
  env-overridable via `NEXT_PUBLIC_PRO_PRICE`).

The split is detailed in [free-vs-pro.md](./free-vs-pro.md) and
[report-types.md](./report-types.md). What the two tiers have in common is the
operating model below.

## The model: a publishing house, not a live API

AssetFrame is a **publishing house, not a live API** (`mvp/README.md` §1). A curated
*edition* for one instrument is generated on a schedule, reviewed by a human, published
once, and then every reader downloads the same pre-built files from a zero-egress CDN
(Cloudflare R2). User count barely affects cost or speed. The architecture detail is in
[../architecture/system-overview.md](../architecture/system-overview.md).

New editions publish **daily at 06:00 UK time** — pre-session, before the LSE opens at
08:00 (`SITE.publish` in `site.config.ts`; the homepage countdown is driven from the same
config). Cadence and timezone are configurable.

## The promise: accountability

The product rests on a single promise — **accountability**. From `app/about/page.tsx`,
AssetFrame's three stated principles are:

- **Falsifiable** — every Pro report logs exact levels and an exact window *before* the
  session. A vague take can't be graded; AssetFrame's can be proven right or wrong.
- **Scored** — after the window closes, a deterministic engine grades each call against
  the price tape (Hit / Miss / No-trigger). No human nudges the result.
- **Transparent** — results land in an append-only ledger. Nothing is edited, re-tuned or
  cherry-picked, and the whole record is public. *The record is the product.*

This is enforced by **code, not editorial discipline**: predictions are registered up
front, scored only after their window closes, appended (never rewritten), and the public
track record is derived from that ledger. The mechanism is documented in
[methodology.md](./methodology.md), [../ledger/overview.md](../ledger/overview.md) and
[../predictions/overview.md](../predictions/overview.md).

## How an edition is made (the short version)

An **AI analyst** writes the qualitative work — thesis, scenarios, catalysts, conviction
reasoning, sourced claims. A **deterministic Python engine** compiles everything numerical
and structural — price levels, conditional long/short setups with risk:reward, the
calibrated confidence score, and the falsifiable predictions. A **human** reviews every
edition before it publishes.

> *AI = analyst / strategist / research desk. Python = compiler / validator. Ledger =
> memory + calibration + proof. Confidence = deterministic + auditable. Social = optional,
> subtract-only. Human = final reviewer. Website = trust / delivery.* (`mvp/README.md` §2)

So the parts a reader is asked to trust — the numbers, the predictions, the scoring — are
the parts that can be audited. Full pipeline:
[methodology.md](./methodology.md) and
[../architecture/generation-pipeline.md](../architecture/generation-pipeline.md).

## What it covers

Per `app/faq/page.tsx` ("Which instruments do you cover?"): **futures, FX, crypto and US
single stocks**. The published menu grows over time; the live list is the
[reports page](../website/reports-page.md) (`/reports`). Session handling per asset class
(CME futures, FX spot, 24/7 crypto, US equity RTH) is owned by
[../report-engine/sessions.md](../report-engine/sessions.md).

## How it's consumed

- **Website** — the reports browser, the reader, the Pro-gated track record, accounts and
  billing. See [../website/routes.md](../website/routes.md).
- **MCP server** (`/api/mcp`) — five read-only tools for agents (Claude, Cursor, etc.);
  free tools are keyless, `get_pro_report` is OAuth + Pro. See
  [../mcp/overview.md](../mcp/overview.md).
- **REST API** (`/api/v1`) — read-only JSON catalog + track record + OpenAPI schema. See
  [../api/overview.md](../api/overview.md).
- **Notifications** — follow an instrument and get a web-push (primary) or email
  (fallback) alert when a new edition publishes. See `mvp/README.md` §6.

## What AssetFrame is *not*

From `app/about/page.tsx` and `SITE.disclaimer`:

AssetFrame is **general market research and decision support**. It is **not** investment
advice, **not** a personal recommendation, it **never tells anyone to buy or sell**, and it
**places no trades** — there is no order-placement path anywhere in the system. No outcome
is guaranteed; markets are uncertain and your capital is at risk. A calibrated confidence
score is an estimate of how a setup may resolve, *not* a promise of profit. Do your own
research and consider an FCA-authorised adviser.

The full legal posture, the no-auto-trading hard rule, and the verbatim disclaimer wording
are in [disclaimers.md](./disclaimers.md).

## Current state (day one)

Honest as-of state, consistent with the rest of this vault and `app/faq/page.tsx`:

- **Track record: 0 scored results.** Predictions have been registered for many instruments
  but no window has closed and been scored yet, so the public track record shows 0 graded
  calls and displays its **public methodology** instead of populated numbers. The first
  results land as the earliest windows close. See [methodology.md](./methodology.md) and
  [../ledger/overview.md](../ledger/overview.md).
- **Reviews: "coming soon."** `/reviews` surfaces Google reviews via `lib/google-reviews.ts`
  but needs `GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID` (a Google Business Profile), which are
  not yet set. Until then the page shows its empty/coming-soon state. See
  [../website/company-pages.md](../website/company-pages.md).

Launch-readiness is **GREEN for MVP** — see
[../changelog/launch-audit.md](../changelog/launch-audit.md).
