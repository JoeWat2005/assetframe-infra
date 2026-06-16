# Disclaimers, compliance posture & limits

> Part of the AssetFrame `/documentation` vault → `product/`.
> Companion docs: [product-overview.md](./product-overview.md) ·
> [methodology.md](./methodology.md) · [free-vs-pro.md](./free-vs-pro.md) ·
> [report-types.md](./report-types.md)
> Sources: `site.config.ts` (`SITE.disclaimer`), `mvp/README.md` §10, `mvp/CLAUDE.md`,
> `app/about/page.tsx`, `app/faq/page.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx`.
> The Terms/Privacy *pages* are documented in
> [../website/company-pages.md](../website/company-pages.md).

## What AssetFrame is, in compliance terms

AssetFrame publishes **general market research and decision support**. It is:

- **not** investment advice,
- **not** a personal recommendation,
- and it **executes no trades** — there is no order-placement path anywhere in the system
  (`mvp/README.md` §10).

No outcome is guaranteed; markets are uncertain and capital is at risk. A calibrated
confidence score is an estimate of how a setup may resolve, **not** a promise of profit
(`app/about/page.tsx`, `app/faq/page.tsx`).

## The disclaimer wording (carried on every report and page)

The canonical disclaimer is `SITE.disclaimer` in `site.config.ts`, surfaced on every page
and included in every API payload:

> *AssetFrame publishes general market research and decision-support analysis. It is not
> investment advice and not a personal recommendation. We do not tell anyone to buy or sell.
> Markets are uncertain and you can lose money. No outcome is guaranteed. Do your own
> research and consider an FCA-authorised adviser. AssetFrame never places trades.*

`mvp/README.md` §10 also records the report-carried form:

> *AssetFrame publishes general market research and decision support. It is not investment
> advice, not a personal recommendation, and executes no trades. No outcome is guaranteed;
> markets are uncertain and your capital is at risk. Do your own research and consider an
> FCA-authorised adviser.*

These must **never be removed or softened** (`mvp/CLAUDE.md`).

## No-auto-trading (hard rule)

The system **never places, modifies, or cancels any order on any brokerage**, regardless of
what a report concludes (`mvp/README.md` §10, `mvp/CLAUDE.md`). If a user asks for execution,
the system refuses and explains it is decision-support only. There is no execution path in
the codebase. The trust-boundary enforcement is documented in
[../architecture/trust-boundaries.md](../architecture/trust-boundaries.md#no-auto-trading-hard-rule).

## Language rules that protect the posture

The generation QA gate hard-fails the build on banned wording, so the compliance posture is
enforced mechanically, not just by editorial care (SKILL.md "Language and banned-wording
rules"; [report-types.md](./report-types.md)):

- **Permitted framing:** Research view / Long-biased scenario / Short-biased scenario /
  Conditional setup / Invalidation / No-trade condition / Scenario / General market research
  / Not personal advice.
- **Never written:** "you should buy/sell", "sure trade", "risk-free", "easy profit".
- **"Guaranteed" / "personal recommendation"** appear *only* in negated compliance form
  ("No outcome is guaranteed", "not a personal recommendation"); the QA gate checks the
  preceding context.
- The Pro **verdict box** is a conditional sentence, **never an instruction**.

## Honesty rules (no fabrication)

From `mvp/CLAUDE.md` and `app/faq/page.tsx`:

- Never fabricate prices, news, analyst ratings, financial metrics, or capabilities. If data
  is unavailable, the report says so explicitly (the Source audit + data-gap fields).
- Always state uncertainty, assumptions, data limitations and risks.
- Label every important figure with its source and timestamp, and mark it live, delayed, or
  prior-session.
- Every high-impact factual claim is graded (confirmed / multiple-source / single-source /
  unverified / stale / unavailable); unverified/stale/unavailable claims must not drive a
  thesis (the scaffold hard-fails). See [../research/claims.md](../research/claims.md).

## Copyright & licensing

From `mvp/README.md` §10 (and the Terms): the reports, site, brand and code are
© AssetFrame. Pro and Snapshot reports are licensed for the subscriber's personal,
non-commercial use — redistribution, resale or public sharing is prohibited (Terms §8–9).
Report files are served only through the auth-gated `/api/report` route as short-lived
signed URLs, never as public objects (see
[../storage/signed-urls.md](../storage/signed-urls.md)).

## Data privacy

The privacy posture is on `/privacy` (`app/privacy/page.tsx`, which carries a hardcoded
processor list). The processors in play are Clerk (auth), Lemon Squeezy (merchant of record
/ billing), Neon (database), Cloudflare R2 (file storage), Vercel (hosting/analytics), and —
once configured — Resend (email) and Google (reviews). See
[../website/company-pages.md](../website/company-pages.md) and
[../security/threat-model.md](../security/threat-model.md).

## Known limitations & caveats (be honest about these)

- **Track record currently shows 0 scored results.** Predictions are registered but no
  window has closed and been scored yet, so the public methodology is shown rather than
  populated numbers; the first results land as the earliest windows close. Do not imply a
  populated track record. See [methodology.md](./methodology.md) and
  [../ledger/overview.md](../ledger/overview.md).
- **Reviews are "coming soon."** `/reviews` needs a Google Business Profile
  (`GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID`), not yet set, so it shows its empty state.
- **Confidence is calibrated, not a promise.** Calibration is near-identity until ~10+
  scored rows accumulate; early confidence numbers lean on Market + Catalyst with a neutral
  Ledger contribution. See [../confidence/limitations.md](../confidence/limitations.md).
- **Data may be delayed.** The default engine feed is Yahoo (delayed); a licensed feed
  (EODHD) is available via a provider switch, but **futures `=F` always stay on Yahoo**
  (`mvp/CLAUDE.md`, `scripts/intraday.py`).

## Regulatory caveat — before charging real money

From `mvp/README.md` §10, treat as a **strong starting point that still needs professional
review**:

- The disclaimer / Terms should be reviewed by a **solicitor familiar with FCA financial
  promotions** before charging real money. The legal Terms/Privacy were rewritten for
  launch but are **not** a substitute for solicitor sign-off (see
  [../changelog/launch-audit.md](../changelog/launch-audit.md), "Known limitations").
- Reports for **paying customers** should be generated on **compliant/licensed data feeds** —
  the engine has the provider switch (`ADVISOR_DATA_PROVIDER` / `EODHD_API_KEY` in
  `scripts/intraday.py`; futures stay on Yahoo).
- AssetFrame is **not** an FCA-authorised adviser and does not present itself as one.

> Whether AssetFrame's financial-promotions exemptions/status have been formally assessed by
> a regulated person is **NOT VERIFIED** in the codebase — the README flags solicitor review
> as an outstanding action, which implies it has not yet been completed.
