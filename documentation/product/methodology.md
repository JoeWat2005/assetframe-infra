# Methodology

> Part of the AssetFrame `/documentation` vault → `product/`.
> Companion docs: [product-overview.md](./product-overview.md) ·
> [free-vs-pro.md](./free-vs-pro.md) · [report-types.md](./report-types.md) ·
> [disclaimers.md](./disclaimers.md)
> Sources: `app/how-it-works/page.tsx`, `app/about/page.tsx`, `app/faq/page.tsx`,
> `mvp/README.md` §§2–3 + §7, `.claude/skills/mvp/SKILL.md`.
> This is the product-facing summary. The engine internals live in
> [../architecture/](../architecture/system-overview.md), [../confidence/](../confidence/overview.md),
> [../predictions/](../predictions/overview.md) and [../ledger/](../ledger/overview.md).

AssetFrame's method is the answer to one question: *why should you trust a market call?*
The answer is that the call is made in a way that can be checked, and then it is checked.

## The split that makes it auditable

The qualitative work is done by an **AI analyst**; the numbers, the predictions and the
scoring are done by a **deterministic engine**. So the parts you're asked to trust are the
parts that can be audited (`app/how-it-works/page.tsx`).

| Actor | Does | Never does |
|---|---|---|
| **AI analyst** | Studies the instrument; writes the thesis, scenarios, catalysts, conviction reasoning and *sourced claims*; frames the prediction *intent* in words. Authors exactly one artifact: the research brief. | Types a price, level, R:R, ladder or confidence number. |
| **Python engine** | Compiles every price level, conditional long/short setup, risk:reward, the price ladder, the calibrated confidence score and the falsifiable predictions. Same inputs → same output. | Invents a directional view or a thesis. |
| **Ledger** | Records scored outcomes; feeds history back in as an input under a hard no-look-ahead rule. | Gets edited or reordered. |
| **Human** | Reviews every edition before publish. | Nudges a scored result. |

This is the V2 guiding principle (`mvp/README.md` §2):

> *Automate away fragile manual JSON, not the analyst.*

The single hand-authored artifact is the research brief
(`data/briefs/<NAME>_research_brief.json`); everything numerical/structural is compiled and
validated by [`scaffold_payload.py`](../report-engine/scaffold_payload.md), then re-checked
by the [`mvp_report.py`](../report-engine/mvp-report.md) QA gate.

## The six steps (product view)

From `app/how-it-works/page.tsx` — the same pipeline runs for every edition:

1. **Research** — an AI analyst studies the instrument and writes the thesis, scenarios and
   catalysts in plain English (the qualitative view).
2. **Compile** — a deterministic Python engine (Engine V2) turns that view into numbers:
   pivots and price levels, conditional long/short setups with risk:reward, and a calibrated
   confidence score. Every figure is reproducible.
3. **Register** — before the session opens, the engine logs falsifiable predictions: exact
   levels and an exact window. Each can be proven right or wrong.
4. **Publish** — the free Snapshot opens for everyone and the Pro report unlocks with a
   subscription, served from a CDN. Both render from one canonical payload behind a strict
   QA gate.
5. **Score** — after the window closes, the engine grades each prediction against the actual
   tape — Hit, Miss or No-trigger — with no human nudging the result.
6. **Append & learn** — results land in an append-only ledger that is never edited or
   re-tuned. The ledger is *also* an input: the engine learns which setups and regimes have
   worked, with **no look-ahead**, since a call is only ever scored after its window.

The full 12-step engineering flow (scoring-first, research/social packs, the scaffold
compiler, the human-review gate, publish/export/sync) is in
[../architecture/generation-pipeline.md](../architecture/generation-pipeline.md) and
`.claude/skills/mvp/SKILL.md`.

## "Scored after the fact" is mechanical, not editorial

The brand promise is enforced by code (`mvp/README.md` §1, `app/about/page.tsx`):

1. **Predictions are registered up front** — the predictions file is written at publish
   time, each prediction bound to a canonical price level
   ([../predictions/prediction-files.md](../predictions/prediction-files.md)).
2. **Scoring happens only after the window closes, and first** — each new run scores any
   expired window *before* generating anything new; an open window is refused. Verdicts are
   Hit / Miss / No-trigger (Y / N / NT), hit rate counts Y / (Y + N).
   See [../predictions/scoring.md](../predictions/scoring.md) and
   [../ledger/outcome-scoring.md](../ledger/outcome-scoring.md).
3. **The ledger is append-only** — rows are only ever appended, never edited or reordered.
   See [../ledger/append-only-design.md](../ledger/append-only-design.md).
4. **History feeds back without look-ahead** — the read side aggregates only rows whose
   window closed strictly before the report's as-of time. See
   [../ledger/overview.md](../ledger/overview.md).
5. **The public record is derived, never hand-edited** — `export_content.py` builds the
   track-record JSON from the ledger; the website and MCP serve that. See
   [../ledger/track-record-export.md](../ledger/track-record-export.md).

## The confidence score, in plain English

From `app/how-it-works/page.tsx` and `app/faq/page.tsx`:

Each Pro report carries a confidence score from **0 to 100**. It is not hand-waved. The
engine blends three things — the **market structure** the setup is built on, the ledger's
own **track record** for similar calls, and how well the **catalysts** are sourced — then
applies hard caps and a calibration map. Because it is graded against the tape after every
window, it is **calibrated**: the goal is that calls rated, say, 70 actually come true about
70% of the time.

It is a **calibrated estimate of how a setup may resolve — not a guarantee, not a
probability of profit, and not a signal to trade.** Always read it next to the risk rating
and the prediction window. The analyst *explains* the number in prose; the engine *computes*
it. Full maths and the hard-caps reference:
[../confidence/overview.md](../confidence/overview.md),
[../confidence/components.md](../confidence/components.md),
[../confidence/calibration.md](../confidence/calibration.md) and
[../confidence/limitations.md](../confidence/limitations.md).

## The public track record (and its day-one state)

The public track record (`/track-record`) breaks performance down by **instrument, asset
class, prediction type and market regime**, with a stated-vs-realised **calibration curve**
and **hit-rate-over-time** (`app/faq/page.tsx`, `mvp/README.md` §7). Free/signed-out
visitors see the public accuracy headline; the full record is Pro-only.

> **Day-one state: 0 scored results.** As of this writing, predictions have been registered
> for many instruments but no window has closed and been scored, so the track record shows
> **0 graded calls**. The page shows its **methodology and structure** (how scoring works,
> the calibration buckets, the empty-state copy) rather than fabricated numbers; the first
> results land as the earliest windows close (`app/faq/page.tsx`: *"It currently shows 0
> scored results — the first results land as the earliest windows close."*). The calibration
> block becomes meaningful at ≥10 rows, and calibration stays near-identity until enough
> rows accumulate, so early on the honest answer to "what's the hit rate?" is *no scored
> history yet*. See [../ledger/overview.md](../ledger/overview.md) and
> [../website/track-record.md](../website/track-record.md).

## Data sources and honesty rules

- **Source order** (`mvp/CLAUDE.md`): official sources first; then the project engine
  (`scripts/intraday.py`, Yahoo by default, licensed EODHD feed via a provider switch —
  futures `=F` always stay on Yahoo); then configured MCP servers (Alpha Vantage, CoinGecko);
  then WebSearch/WebFetch; then user-provided data. If none can answer, state the gap —
  never invent.
- **Sourcing is enforced.** Every factual claim in the brief must trace to the research pack;
  the QA gate fails unsupported high-impact claims. See
  [../research/source-policy.md](../research/source-policy.md) and
  [../research/claims.md](../research/claims.md).
- **Figures are labelled** live / delayed / prior-session, and reports disclose their
  sources and any data-quality limitations (`app/faq/page.tsx`; the Pro Source audit).
- **Social is subtract-only** — the market-conversation feed may only *reduce* confidence,
  never raise it, and is never a factual source. See [../social/overview.md](../social/overview.md).
- **No fabrication** — never invent prices, news, analyst ratings, or capabilities; if data
  is unavailable the report says so (`mvp/CLAUDE.md`).

## What the methodology does *not* claim

It does not claim to predict the market reliably, to be advice, or to guarantee outcomes. A
calibrated confidence score is an estimate, not a promise of profit (`app/about/page.tsx`).
The honest framing — uncertainty, assumptions, data limitations and risks stated on every
report — is the point. See [disclaimers.md](./disclaimers.md).
