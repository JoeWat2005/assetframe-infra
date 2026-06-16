# The predictions file — `data/predictions/<NAME>_predictions.json`

The registered, machine-checkable call for one report. Written by
`scripts/scaffold_payload.py` at report time, read by `scripts/score_report.py`
to grade it, and read by `scripts/export_content.py` to surface it as an open
call on the web track record.

> **These files are NOT hand-authored.** Engine V2 folds the old "register
> predictions" step into the scaffold. The analyst writes intent in the brief;
> the scaffold compiles the file. Editing one by hand defeats the
> QA-by-construction guarantees below.

## Where it comes from

`scripts/scaffold_payload.py` → `main` assembles the `predictions` dict and writes
it to `data/predictions/<NAME>_predictions.json` (overridable with
`--predictions <path>`). It is written from the *same* compiled data as the report
payload, so the two cannot diverge.

## Full schema

The authoritative schema is the docstring of `scripts/score_report.py` plus the
`predictions = { ... }` assembly block in `scaffold_payload.py` (`main`). Every
field:

| Field | Type | Source / meaning |
|---|---|---|
| `report_id` | string | `AF-YYYYMMDD-<TICKER>`. The ledger keys on this; it also gives the ticker (`ledger_context._ticker_of` splits on the last `-`). |
| `instrument` | string | Human instrument name (e.g. "GBP/JPY"). |
| `symbol` | string | Yahoo/engine symbol (e.g. `GBPJPY=X`). Used to build the refresh command if the CSV is short. |
| `roll_utc` | int | Roll hour (0 for equities; 22 for futures/FX/crypto). Used only to build the refresh command. |
| `view` | string | The research view label (e.g. "Constructive"); copied to the ledger `view` column. |
| `confidence` | int | Published confidence 0-100. **Always equals `payload.confidence`** (written from one source — `conf["published"]`). |
| `conf_version` | int | Confidence engine version; copied to the ledger `conf_version` column. |
| `conf_raw` | number | The **capped** pre-calibration score (`conf["capped"]`), i.e. raw after hard caps but before the calibration map; copied to the ledger `conf_raw` column. See note below. |
| `taxonomy` | object | `{prediction_type, direction, horizon, asset_class, market_regime}` — built and validated by `taxonomy.build_taxonomy`. See [taxonomy.md](taxonomy.md). |
| `window_start_utc` | string | `"YYYY-MM-DD HH:MM"` UTC; from `sessions.get_session`. |
| `window_end_utc` | string | `"YYYY-MM-DD HH:MM"` UTC; from `sessions.get_session`. The scorer and `ledger_context` both gate on this. |
| `hourly_csv` | string | Path to the hourly candle CSV the scorer reads (e.g. `data/candles/<NAME>_hourly.csv`). |
| `predictions` | array | The falsifiable P1..P6 (see below). |
| `setup` | object \| null | The primary setup: `{direction, entry_lo, entry_hi, invalidation, t1}` (note: **no `t2`** in the predictions file — only these five keys). `null` if no setup was built. |

> **`conf_raw` vs `confidence`.** `confidence` is the *published* number (after the
> calibration map). `conf_raw` is set from `conf["capped"]` — the score *after* the
> hard caps but *before* the calibration map. Verified against `scripts/confidence.py`
> (`compute_confidence`): `raw = 50*market + 30*ledger + 20*catalyst + social_adj`,
> then `capped = min(raw, cap)`, then `published = calibrate(capped)`. So the field
> is named `conf_raw` for the ledger column but is populated from `capped`; the
> truly pre-cap value (`conf["raw"]`) lives only in the payload's
> `confidence_breakdown`, not in the predictions file. The confidence math itself is
> documented in `../confidence/`.

### The `predictions[]` array

Each entry is one falsifiable prediction. The shape depends on its scoring
mechanic (the mechanics live in `score_report.py`; see [scoring.md](scoring.md)):

| Mechanic | Keys | Meaning |
|---|---|---|
| `close_above` / `close_below` | `id, type, level, expect, text` | Last bar's close above/below `level`. |
| `range_inside` | `id, type, lo, hi, expect, text` | All bars stay within `lo`..`hi`. |
| `touches` | `id, type, level, expect, text` | Any bar's range contains `level`. |
| `no_close_below` / `no_close_above` | `id, type, level, expect, text` | No hourly close beyond `level`. |
| `no_close_above_after_touch` / `no_close_below_after_touch` | `id, type, touch, level, expect, text` | First bar to touch `touch` must not close beyond `level`; `NT` if never touched. |
| `manual` | `id, type:"manual", note` | Human-resolved; graded `MANUAL` until `--manual` resolves it. No `expect`/`level`. |

`expect` records whether the analyst expects the condition true or false; the
scorer grades the *condition* (`Y`/`N`/`NT`), and `expect` is the editorial framing
surfaced in the report and the web open-call rows.

## How the scaffold builds P1..P6 (by canonical-level reference)

`scaffold_payload.build_predictions_spec(by_id, brief, direction)` maps the
report's canonical levels onto six predictions. `bull = direction == "bullish"`.
Each `v("id")` returns that canonical level's value (or `None`, in which case the
prediction is skipped):

- **P1 — `close_above` PP.** `level = pp`. `expect = bull`. "Session settles
  above/below PP". Emitted only if `pp` exists.
- **P2 — `range_inside` the outer bands.** `lo = tail_lo`, `hi = tail_hi`,
  `expect = True`. "Stays inside the outer bands". Emitted only if both tails
  exist.
- **P3 — `touches` R1.** `level = r1`, `expect = bull`. "R1 is / is not touched".
- **P4 — `no_close_below` the floor.** `level = swing_lo or inner_lo or s1`
  (first available), `expect = True`. "No hourly close below the floor".
- **P5 — `no_close_above_after_touch`.** `touch = r1`, `level = r2`,
  `expect = True`. "First touch of R1 does not close an hour above R2 (NT if
  untouched)". Emitted only if both `r1` and `r2` exist.
- **P6 — `manual`.** Emitted **only if** `brief.manual_prediction` is present
  *and* the `anchor` level exists; `note` = the brief's manual prediction. The
  anchor (last close) value is added to `ledger_levels` so the manual reference
  price is itself a declared canonical level.

Because every reference price (`pp`, `tail_lo`, `tail_hi`, `r1`, `r2`, the floor,
the anchor) is read from the canonical level catalog by id, **every prediction's
reference price is guaranteed to be a canonical level value** — this is enforced
by construction, and `test_scaffold_payload.py::TestQAByConstruction` asserts it.

### `ledger_levels`

`build_predictions_spec` also returns the **distinct** canonical values referenced
by the predictions (de-duped on `round(value, 4)`, preserving order). This becomes
`canonical.ledger_levels` in the payload — "every numeric a prediction references"
— and the QA gate refuses the build if any prediction references a price that is
not a declared level (SKILL.md step 5). It does **not** appear as a top-level field
of the predictions file; it lives in the payload. The predictions file's level
references are implicit in each prediction's `level`/`lo`/`hi`/`touch` values.

## The `setup` block

The primary setup is the long/short setup whose `direction` matches the brief's
`preferred_setup.side` (else the first built setup). Only five keys are copied into
the predictions file:

```json
"setup": {"direction": "long", "entry_lo": 214.44, "entry_hi": 214.55,
          "invalidation": 214.10, "t1": 214.94}
```

`t2` is intentionally omitted from the predictions file (it is in the payload's
`canonical.setups[]`, used for the ladder and R:R display). `score_setup` grades
whether the entry zone filled and whether `t1` or `invalidation` came first — it
does not use `t2`. See [scoring.md](scoring.md).

## The `taxonomy` block

```json
"taxonomy": {"prediction_type": "range_hold", "direction": "neutral",
             "horizon": "next_session", "asset_class": "equity",
             "market_regime": "range"}
```

Built by `taxonomy.build_taxonomy`, which validates all five fields. This block is
carried into the ledger's taxonomy columns by `score_report.py` and threads the
prediction through track record / confidence / calibration / research memory. Fully
documented in [taxonomy.md](taxonomy.md).

## Integrity guarantees (why these files are trustworthy)

- **`payload.confidence == predictions.confidence` — always.** Both are written
  from `conf["published"]` in `scaffold_payload.main`; there is no second source.
- **Every prediction price is a canonical level.** Guaranteed by construction in
  `build_predictions_spec`; regression-tested in
  `test_scaffold_payload.py::TestQAByConstruction`.
- **Taxonomy typos cannot freeze in.** `build_taxonomy` validates against the
  canonical sets and raises `TaxonomyError` (a `ValueError` subclass) on a bad
  value, aborting the scaffold before the file is written.

## Storage, git, and the web export

- **Gitignored.** `.gitignore` lines 12-15: `data/predictions/*` is per-machine
  working state ("Registered predictions are per-machine working state; the scored
  results land in the tracked ledger"). Only `web/content/*.json` and the ledger
  reach git/Neon (README §2). To version pending predictions, delete those two
  `.gitignore` lines.
- **One of the few inputs `export_content.py` reads for open calls.**
  `export_content.load_track_record` does `pred_dir.glob("*_predictions.json")` and
  emits an `open` entry per file with `reportId, instrument, symbol, view,
  confidence, windowEnd, n, nManual, hits, scored`, and a `predictions[]` of
  `{id, type, text, manual, expect, verdict, predType}`. `verdict` stays `""` until
  the ledger row exists; `scored` flips when the `report_id` appears in the ledger.

## Current state

`data/predictions/` currently holds **22** files (e.g. `WTI_predictions.json`,
`BTC_predictions.json`, `AAPL_predictions.json` + `AAPL_af_predictions.json`,
`ETH_af2_predictions.json`, `SOL_af_predictions.json`, …). The append-only
`ledger/outcome_ledger.csv` **does not yet exist** — so on the web these are all
**open calls** (`0/n`, no verdicts), not yet scored. The ledger is created on the
first scored report (see [lifecycle.md](lifecycle.md), [scoring.md](scoring.md)).

## Related docs

- [overview.md](overview.md) — what a prediction is; the two type concepts.
- [lifecycle.md](lifecycle.md) — how the file is created, registered, and scored.
- [scoring.md](scoring.md) — how each prediction and the setup are graded.
- [taxonomy.md](taxonomy.md) — the taxonomy block in full.
- `../ledger/` — the ledger row schema (where scored verdicts land).
- `../confidence/` — `conf_raw` / `confidence` math.
