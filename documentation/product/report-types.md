# Report types — Snapshot vs Pro

> Part of the AssetFrame `/documentation` vault → `product/`.
> Companion docs: [free-vs-pro.md](./free-vs-pro.md) ·
> [product-overview.md](./product-overview.md) · [methodology.md](./methodology.md) ·
> [disclaimers.md](./disclaimers.md)
> Sources: `.claude/skills/mvp/SKILL.md` step 10 (authoritative report contents),
> `app/pricing/page.tsx`, `mvp/README.md` §1.
> Engine that renders these: [../report-engine/mvp-report.md](../report-engine/mvp-report.md).

Each AssetFrame edition produces **both** report types from **one canonical payload**, so
the Snapshot and Pro can never state contradictory numbers. [free-vs-pro.md](./free-vs-pro.md)
covers the marketed feature lists and the price gating; this page is the document-level
table of contents for each report.

## Output artifacts per edition

One `/mvp` run writes to `reports/YYYY-MM-DD/<INSTRUMENT>/` (`mvp/CLAUDE.md`, SKILL.md):

| File | What it is |
|---|---|
| `free.pdf` / `free.html` | The Snapshot (free tier) |
| `pro.pdf` / `pro.html` | The Pro report (paid tier) |
| `metadata.json` | Machine metadata (status, risk, confidence band, window, etc.) |
| `preview.png` | Social/preview image |

Report IDs follow `AF-YYYYMMDD-<INSTRUMENT>` (SKILL.md). The PDF/HTML rendering, the QA gate
and the structure are owned by
[../report-engine/mvp-report.md](../report-engine/mvp-report.md); the generated-artifact
shapes are in [../report-engine/generated-artifacts.md](../report-engine/generated-artifacts.md).

## AssetFrame Snapshot (free, one page)

Contents, per SKILL.md step 10:

- Logo, instrument + ticker + asset class, timestamp + timezone, risk window
- **Status & risk badges** (separate badges)
- Last price + bar time, **broad expected range**, basic data-quality note
- **One chart** — at most 3 labelled levels, **no pivots/bands**
- **Three bullets** — core thesis / main catalyst / main risk
- **Simplified Bull/Base/Bear matrix**
- A visual **timeline strip**
- A **Pro teaser** and a short disclaimer

**Excluded from the Snapshot (QA-enforced):** entries, invalidation logic, R:R, sizing
math, options ideas, the scorecard, the source audit, the outcome ledger, and the price
ladder. The Snapshot may *mention* that calls are scored, but never shows the ledger. The
hard split is enforced by the QA gate and by `scaffold_payload.py`'s `_assert_free_split`
(see [free-vs-pro.md](./free-vs-pro.md) and
[../testing/security-tests.md](../testing/security-tests.md)).

## AssetFrame Pro (paid, 3–6 pages)

Contents, in render order, per SKILL.md step 10:

1. **Executive header** + a **verdict box** (one conditional sentence, then Best
   opportunity / Main risk / Stand-aside condition — never an instruction)
2. **Daily regime chart**, **intraday chart**, **RSI**
3. **Price ladder** — upper tail → R2 → T2 → T1 → trigger → last → entry zone → support →
   invalidation → lower tail (canonical levels only; auto-caption: *"Levels are conditional
   research references, not trade instructions."*)
4. **Confidence gauge** (0–100, with the band)
5. **Market summary** (+ a cross-asset table)
6. **Long / Short Research View**
7. **Scenario matrix**
8. **Event-risk timeline**
9. **Technicals & key levels** (distance + classification)
10. **Conditional setups** (entry / invalidation / T1 / T2 with R:R)
11. **Options / Hedging context** — data-gated: VIX/VVIX/term-structure & implied-move-vs-ATR
    for indices, venue IV/funding/basis for crypto if sourced; otherwise exactly *"No options
    context included: reliable IV/skew data unavailable."* — never constructs option trades
12. **Asset-specific statistics** (a per-asset-class menu; every stat sourced + timestamped,
    no filler)
13. **"What can go wrong?"**
14. Generic **contract/risk math** (educational; sizing-depends-on-circumstances)
15. **Trade-quality scorecard** (rendered from the confidence breakdown — the component
    table, the caps applied, and the calibration note)
16. **Outcome ledger** (registered predictions; *"Ledger starts here."* when empty — see
    day-one state below)
17. Full **Source audit**
18. **Asset-session rules**
19. Footer on every page

The confidence gauge + scorecard consume the deterministic confidence breakdown — see
[../confidence/overview.md](../confidence/overview.md). The registered predictions in the
ledger section come from the predictions file — see
[../predictions/overview.md](../predictions/overview.md).

## One payload, two renders (why they agree)

Both reports render from the single canonical payload built by `scaffold_payload.py`. Every
price that appears anywhere lives **once** in the canonical level set, so:

- Price triple-equality holds by construction (CSV last close == canonical == header).
- Levels ↔ setups ↔ ladder ↔ ledger references are the same objects.
- `payload.confidence == predictions.confidence` always.

These identities are checked again by the QA gate, which **aborts the build** on any
violation (SKILL.md step 10; [../report-engine/mvp-report.md](../report-engine/mvp-report.md)).

## Language rules (QA-enforced, both tiers)

Permitted framing: Research view / Long-biased scenario / Short-biased scenario /
Conditional setup / Invalidation / No-trade condition / Scenario. **Never:** "you should
buy/sell", "sure trade", "risk-free", "easy profit". "Guaranteed" and "personal
recommendation" appear *only* in negated compliance form ("No outcome is guaranteed", "not a
personal recommendation") — the QA gate checks the preceding context. R:R is always rendered
by the engine ("T1 1.5x; T2 2.1x"), never hand-typed. See [disclaimers.md](./disclaimers.md)
and SKILL.md "Language and banned-wording rules".

## Day-one state (the outcome-ledger section)

The Pro **Outcome ledger** section shows registered predictions and, since no window has
been scored yet, renders the empty-state *"Ledger starts here."* The first graded rows
appear as windows close and are scored. The Free tier may mention scoring but never shows
the ledger. See [methodology.md](./methodology.md) and
[../ledger/overview.md](../ledger/overview.md).
