# Prediction lifecycle

The full life of a prediction, from the analyst's intent through to feeding the
ledger back into the next brief — all under a hard no-look-ahead rule. Read
[overview.md](overview.md) first for what a prediction *is*; this doc is the
sequence and the edge cases.

## The lifecycle in one line

```
brief intent (AI, prose only)
  -> scaffold compiles falsifiable P1..P6 + taxonomy (bound to canonical levels)
  -> registered in data/predictions/ at report time
  -> window opens (sessions.py)
  -> window closes
  -> next run scores expired windows FIRST (no look-ahead) via score_report.py
  -> ONE row appended to the append-only ledger
  -> ledger_context.py / research_memory.py feed history back into the next brief + confidence
```

An incomplete window is **never** scored, except by a deliberate `--force`
PARTIAL (see edge cases).

## Stage by stage

### 1. Brief intent (AI — the only hand-authored artifact)

**File:** `data/briefs/<NAME>_research_brief.json` (gitignored).

The analyst (AI) writes prose, prediction *intent*, and sourced claims —
**never prices, levels, R:R, ladders, or confidence numbers** (see `mvp/README.md`
§3 step 6). The intent that matters for predictions is
`brief.primary_prediction.type` (the archetype) and, optionally,
`brief.manual_prediction` (a human-resolved condition that becomes P6). Direction,
horizon, and market regime are also taken from the brief and normalised by
`scripts/taxonomy.py`.

### 2. Scaffold compilation

**File:** `scripts/scaffold_payload.py` — functions `build_levels`,
`build_predictions_spec`, `build_setups`, `assemble`, `main`.

`scaffold_payload.py` is the compiler/validator. It:

- reads the engine analysis JSON and builds the canonical **level catalog**
  (`build_levels`): pivots / ATR bands / swings, each with an id, class, label,
  and a value rounded to sensible decimals;
- compiles **P1..P6** (`build_predictions_spec`) — each prediction's reference
  price IS a canonical level value picked by id, so a prediction price can never
  drift from the report's level map (this is QA-by-construction; see
  [prediction-files.md](prediction-files.md));
- builds the long/short **setups** and picks the **primary** setup matching the
  brief's `preferred_setup.side`;
- assembles the **taxonomy block** via `taxonomy.build_taxonomy(...)` (validates
  prediction_type, direction, horizon, asset_class, market_regime — a typo raises
  `TaxonomyError` and aborts, so it can never freeze into the ledger);
- computes confidence via `confidence.compute_confidence` and writes the *same*
  published value into both the payload and the predictions file (`payload.confidence
  == predictions.confidence` by construction).

Run `python scripts/scaffold_payload.py <NAME> --session-profile <profile> --check`
first — `--check` validates and prints the would-be confidence without writing
anything (exit 2 on a brief/validation error).

### 3. Registration

**File written:** `data/predictions/<NAME>_predictions.json` (gitignored;
`.gitignore` lines 14-15).

This is the registered call. In Engine V2 there is no separate "register
predictions" step — the scaffold writes the predictions file as part of report
generation (SKILL.md step 10 confirms the scorer schema and the `hourly_csv`
pointer). If the instrument's *prior* predictions file is still unscored (its
window has not closed), do NOT overwrite it: write `<PREFIX>_af_predictions.json`
instead. Both names match the scorer's `*_predictions.json` scan, and the ledger's
`report_id` check prevents double-scoring (SKILL.md step 10; the `data/predictions/`
dir today shows exactly this — e.g. `AAPL_predictions.json` alongside
`AAPL_af_predictions.json`).

Once written, the file is also read by `scripts/export_content.py`
(`pred_dir.glob("*_predictions.json")`) to surface **open calls** on the web track
record — each prediction's id/type/text/expect/predType plus the report-level
view/confidence/window. Verdicts stay `""` until the ledger is written.

### 4. Window opens

**File:** `scripts/sessions.py` (`get_session`).

The session profile sets `window_start_utc` and `window_end_utc` — the next full
session (next regular session for `us_equity_rth`; rolling 24h for `crypto_24_7`;
the window rolls forward when little of the current session remains:
<90 min, <240 min on Fridays — per SKILL.md step 4). These are copied verbatim into
the predictions file. The window is now *open*: the call is live but unscorable.

### 5. Window closes

When wall-clock time passes `window_end_utc`, the window is closed and the call is
eligible to be scored on the next pipeline run. Nothing happens automatically at
the instant of closure — scoring is pull-based, triggered by the next `/mvp` run.

### 6. Scoring (expired windows first — no look-ahead)

**File:** `scripts/score_report.py` (`main`, `score_prediction`, `score_setup`).

The very first step of any pipeline run (SKILL.md step 1) is to find
`data/predictions/*_predictions.json` whose `window_end_utc` has passed with no
ledger row, refresh that instrument's hourly CSV, and run:

```
python scripts/score_report.py data/predictions/<NAME>_predictions.json [--manual ID=Y|N|NT]
```

Doing this *first* — before generating any new report — is what keeps the history
provably free of look-ahead: a fresh report can never be informed by an outcome
that has not yet been scored. Each prediction is graded `Y`/`N`/`NT`/`MANUAL`; the
setup is graded; and exactly **one** row is appended to the ledger. Full grading
detail is in [scoring.md](scoring.md).

### 7. Ledger append

**File:** `ledger/outcome_ledger.csv` (append-only).

`score_report.py` appends one row per scored report and never rewrites existing
rows. It creates the file and writes the header on the first scored report. The
row/column schema and append-only design are documented in `../ledger/` — not
duplicated here.

### 8. Feedback (ledger as research input, no look-ahead)

**File:** `scripts/ledger_context.py` (`load_rows`, `build_context`).

Before the AI writes the *next* brief, `ledger_context.py` turns the append-only
ledger into a research input: per-instrument / asset-class / prediction-type hit
rates, streaks, recent drift, similar-setup history, and `notes_for_ai[]`. It is
handed to the AI and consumed by `confidence.ledger_confidence`.

**Hard no-look-ahead rule** (stated in the module docstring): `load_rows` keeps
only rows whose `window_end_utc` is strictly before `--as-of` (default: now).
Scoring already happens after window close, but the filter is on `window_end_utc`
so the context is provably free of look-ahead *even if a row is mis-stamped*.
(`research_memory.py` adds reasoning-level learning under the same rule; future.)

## Edge cases

### Window still open → `--force` gives a PARTIAL score

If `now < window_end_utc`, `score_report.py` prints
`window still open until <...> UTC - not scored` and returns (exit 0) without
writing. With `--force`, it scores the bars available so far, clamps the effective
window end to `now`, and marks the row `partial = yes`. Use this only deliberately
(e.g. to preview), never as the normal path — a clean score waits for the window
to close.

### Hourly CSV doesn't cover the window → exit 3

Two coverage failures, both protecting against scoring on stale data:

- **No bars in window** — `score_report.py` exits 3 and prints the exact refresh
  command (an `intraday.py ...` invocation built from the file's symbol/roll).
- **CSV stops too early** — if the last bar is more than `TAIL_TOLERANCE_MIN`
  (75 minutes, one hourly bar stamped at bar-open plus slack) short of the window
  end, it exits 3 with the same refresh command, *unless* the market genuinely
  closed early (holiday/half-day), in which case re-running with `--force` scores
  the available bars and marks the row PARTIAL.

Exit 3 means "refresh the hourly CSV via `scripts/intraday.py`, then retry" — it
is not a grading verdict. See [scoring.md](scoring.md) for the guards in full.

### Day-one empty ledger

On day one (today's actual state), `ledger/outcome_ledger.csv` does not exist.
This degrades gracefully:

- `ledger_context.py` returns a valid "no history yet" context (neutral) so the
  pipeline runs — `notes_for_ai` states there is no scored history and confidence
  rests on the market and catalyst components, with the ledger component neutral
  (`_patterns_and_notes`, `inst_n == 0` branch).
- `score_report.py` creates the file and header on the first scored report.
- The web export shows open calls with `0/n` and no calibration block (calibration
  requires ≥10 scored rows).

### Manual predictions left MANUAL

A `type: "manual"` prediction (P6) is graded `MANUAL` by `score_prediction` —
it needs human input. Resolve it with `--manual P6=Y|N|NT`. If left unresolved it
**stays MANUAL** and is **excluded from the hit rate** (hit rate counts only
`Y`/`N`). `validate_manual` rejects any `--manual` id that is not a manual-type
prediction in the file *before any ledger write* (exit 2), so a typo can never
freeze a wrong verdict. SKILL.md step 1: resolve manuals via WebSearch where you
can; leave genuinely unresolvable ones MANUAL with a stated reason.

## Related docs

- [overview.md](overview.md) — what a prediction is; the two type concepts.
- [prediction-files.md](prediction-files.md) — the registered file schema.
- [scoring.md](scoring.md) — the scorer in depth (mechanics, guards, exit codes).
- [taxonomy.md](taxonomy.md) — the taxonomy block and its validators.
- `../ledger/` — the ledger row schema + append-only invariant.
- `../confidence/` — `confidence.py` (the score) and `calibrate.py` (the map).
