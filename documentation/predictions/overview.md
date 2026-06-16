# Predictions — overview

What a "prediction" is in AssetFrame, and how predictions thread through the
whole system. This is the index for the `predictions/` documentation vault.

## What a prediction is

A prediction in AssetFrame is a **falsifiable, machine-checkable statement about
the next session**, registered up front (the moment the Pro edition is published)
and scored after the fact (once its window has closed). It is never a vibe, a
target, or a recommendation — it is a precise condition over the price tape that
a deterministic scorer can grade `Y` / `N` / `NT` / `MANUAL` with no human
judgement (the one exception being explicit `manual` predictions, see below).

The defining properties:

- **Falsifiable** — every prediction states an expectation (`expect: true/false`)
  about a condition that the tape either met or did not.
- **Machine-checkable** — each prediction carries a *scoring mechanic* and the
  *canonical level value(s)* it references, so `scripts/score_report.py` can grade
  it from the hourly CSV alone.
- **Next-session** — the prediction is scoped to a single prediction window
  (`window_start_utc` .. `window_end_utc`) derived by `scripts/sessions.py` for the
  next full session (rolling 24h for crypto).
- **Registered up front** — the predictions file is written at report time by
  `scripts/scaffold_payload.py`; predictions are not added after the window opens
  (that would be look-ahead).
- **Scored after the fact** — the next pipeline run scores expired windows *first*,
  before generating any new report. The "scored after the fact" promise is
  mechanical, not editorial (see `mvp/README.md` §1, §7).

The analyst (the AI) never writes prices or chooses scoring mechanics by hand.
The AI authors *intent* in the research brief (prose + a `primary_prediction.type`
+ sourced claims, **never prices**); `scaffold_payload.py` compiles that intent
into the concrete P1..P6 predictions, binding each to a canonical level value so
the numbers cannot drift from the report's level map. See
[prediction-files.md](prediction-files.md) and `mvp/README.md` §3 step 7.

## The two "type" concepts — do NOT confuse them

This is the single most important distinction in the prediction system, and the
docstring of `scripts/taxonomy.py` calls it out explicitly. There are two
separate things both loosely called "type":

### 1. Prediction TYPE — the strategic archetype (one per report)

The *shape of the call* the analyst is making. Defined in
`taxonomy.PREDICTION_TYPES`:

```
breakout | rejection | continuation | mean_reversion | range_hold | volatility_expansion
```

There is exactly **one** prediction type per edition. It tags the primary
prediction and the whole edition, and is carried into the taxonomy block of the
predictions file, into the ledger (`pred_type` column), and into the editions
table. It is what enables aggregate insights like *"breakout predictions in
high-volatility crypto regimes hit 71%."*

Lives in: `scripts/taxonomy.py` (`PREDICTION_TYPES`,
`validate_prediction_type`). Fully documented in [taxonomy.md](taxonomy.md).

### 2. Scoring MECHANIC — how an individual prediction is graded (per P1..Pn)

The *grading rule* for one falsifiable prediction. Defined and implemented in
`scripts/score_report.py` (`score_prediction`):

```
close_above | close_below | range_inside | touches |
no_close_below | no_close_above |
no_close_above_after_touch | no_close_below_after_touch | manual
```

A single report has several predictions (P1..P6), each with its own scoring
mechanic. The taxonomy/archetype above does **not** change these — `taxonomy.py`
does not touch them, and `score_report.py` does not import the archetype to grade
a prediction. Fully documented in [scoring.md](scoring.md).

> Mnemonic: the *prediction type* describes the report ("this is a breakout
> call"); the *scoring mechanic* describes how each line is checked ("P1 is graded
> by `close_above` of PP"). One archetype, many mechanics.

## How predictions thread through the system

Predictions are the spine of AssetFrame's accountability promise. The vocabulary
defined in `taxonomy.py` threads through the entire pipeline:

```
predictions -> ledger -> track record -> confidence -> calibration -> research memory
```

Stage by stage (each with its source file):

1. **Intent** — the AI writes `data/briefs/<NAME>_research_brief.json` (prose +
   `primary_prediction.type` + sourced claims, never prices).
2. **Compilation** — `scripts/scaffold_payload.py` (`build_predictions_spec`)
   compiles falsifiable P1..P6, each bound to a canonical level value, plus the
   taxonomy block, and writes `data/predictions/<NAME>_predictions.json`.
3. **Registration** — that file is the registered call; it is one of the few
   inputs `scripts/export_content.py` reads to surface *open calls* on the web
   track record.
4. **Window** — `scripts/sessions.py` sets the window; the window opens and later
   closes.
5. **Scoring** — the next run's first act is `scripts/score_report.py`, which
   grades each expired prediction and appends one row to the append-only
   `ledger/outcome_ledger.csv`.
6. **Feedback (no look-ahead)** — `scripts/ledger_context.py` turns the ledger
   back into a research *input* for the next brief and for the confidence engine,
   aggregating only rows whose window closed strictly before the report's
   generation time. (`research_memory.py` adds reasoning-level learning under the
   same rule; future.)
7. **Confidence + calibration** — per-confidence-bucket realised hit rates feed
   `confidence.py` and `calibrate.py`.

The taxonomy is what lets this loop produce *insights*, not just a tally —
hit rates by instrument, asset class, prediction type, and market regime.

## Where things live (real paths)

| Concern | File |
|---|---|
| Shared prediction vocabulary + validators | `scripts/taxonomy.py` |
| Compiler that writes the predictions file | `scripts/scaffold_payload.py` (`build_predictions_spec`, `assemble`) |
| The registered predictions file | `data/predictions/<NAME>_predictions.json` (gitignored) |
| The scorer | `scripts/score_report.py` |
| Append-only outcome record | `ledger/outcome_ledger.csv` |
| Ledger-as-input (feedback, no look-ahead) | `scripts/ledger_context.py` |
| Web open-calls / track-record export | `scripts/export_content.py` |
| Operating manual (steps 1, 7, 9, 10) | `.claude/skills/mvp/SKILL.md` |

## Current state (as of writing)

`data/predictions/` currently holds **22** registered predictions files, but
`ledger/outcome_ledger.csv` **does not yet exist** (only `ledger/.gitkeep`,
`calibration_map.json`, and `research_memory.json` are present). In other words:
these are all **open calls** whose windows have not yet been scored. The ledger
file and its header are created by `score_report.py` on the first scored report
(see [scoring.md](scoring.md), [lifecycle.md](lifecycle.md)).

## Related docs

In this folder:

- [lifecycle.md](lifecycle.md) — brief intent → compile → register → window →
  score → ledger → feedback, with edge cases.
- [prediction-files.md](prediction-files.md) — the `data/predictions/*.json`
  schema in full and how P1..P6 are built.
- [scoring.md](scoring.md) — `score_report.py` in depth: every mechanic, the
  setup grader, verdicts, guards, exit codes.
- [taxonomy.md](taxonomy.md) — `taxonomy.py` in full: canonical sets, validators,
  band vs bucket, threading.

Adjacent vaults (cross-link, not duplicated here):

- `../ledger/` — the ledger ROW/column schema and append-only design.
- `../confidence/` — the confidence MATH (`confidence.py`) and `calibrate.py`.
