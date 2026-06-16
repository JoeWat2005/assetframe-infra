# Scoring — `scripts/score_report.py`

The scorer resolves a report's falsifiable predictions against the price tape and
appends one row to the append-only ledger. This doc owns the **scoring mechanics**
(exactly how each prediction is graded), the setup grader, verdicts, the safety
guards, and the exit codes. The ledger **row/column schema** and its append-only
design live in [`../ledger/outcome-scoring.md`](../ledger/outcome-scoring.md) —
cross-linked, not duplicated.

## Command

```
python scripts/score_report.py <predictions.json> [--hourly <csv>] [--force] \
       [--manual ID=V[,ID=V...]] [--dry-run]
```

- `<predictions.json>` — a registered `data/predictions/<NAME>_predictions.json`
  (schema in [prediction-files.md](prediction-files.md)).
- `--hourly <csv>` — override the hourly CSV (default: the file's `hourly_csv`).
- `--manual ID=V[,...]` — resolve `manual` predictions; `V` in `Y|N|NT`.
  Repeatable. Validated *before* any ledger write.
- `--dry-run` — compute and print everything, write nothing.
- `--force` — score an open window (PARTIAL), or accept a short hourly CSV
  (early close / holiday).

## Verdicts

Each prediction resolves to one of four verdicts:

| Verdict | Meaning |
|---|---|
| `Y` | The condition came true. |
| `N` | The condition did not come true. |
| `NT` | "No trigger" — the condition's precondition never occurred (e.g. an *after-touch* mechanic whose `touch` level was never reached, or *any* mechanic when there are no bars). |
| `MANUAL` | A `manual`-type prediction awaiting human input. |

**Hit rate = `Y / (Y + N)`.** `NT` and `MANUAL` are excluded from the
denominator. Computed in `main` (`rate = round(100 * hits / (hits + misses), 1)`),
where `hits` counts `Y` and `misses` counts `N`.

## The scoring mechanics (`score_prediction`)

`score_prediction(p, bars)` grades one prediction against the in-window `bars`
(each bar a dict `{t, o, h, l, c}`, loaded by `load_bars` from the CSV and filtered
**inclusively** to `window_start_utc .. window_end_utc`). Guards first:

- `type == "manual"` → returns `MANUAL` (no grading).
- no `bars` at all → returns `NT` (nothing happened in the window).

Then, per mechanic:

| Mechanic | Graded exactly how | `Y` when |
|---|---|---|
| `close_above` | last bar's close vs `level` | `bars[-1].c > level` |
| `close_below` | last bar's close vs `level` | `bars[-1].c < level` |
| `range_inside` | min low and max high vs `lo`/`hi` | `min(low) >= lo` **and** `max(high) <= hi` |
| `touches` | any bar's range contains `level` | `any(b.l <= level <= b.h)` |
| `no_close_below` | every close vs `level` | `all(b.c >= level)` |
| `no_close_above` | every close vs `level` | `all(b.c <= level)` |
| `no_close_above_after_touch` | first bar with `b.h >= touch`; if none → `NT`; else that bar must not close above `level` | first-touch bar's `c <= level` |
| `no_close_below_after_touch` | first bar with `b.l <= touch`; if none → `NT`; else that bar must not close below `level` | first-touch bar's `c >= level` |
| anything else | — | returns `UNKNOWN(<type>)` (a guard so a bad type is visible, never silently `Y`/`N`) |

Notes that matter:

- **`range_inside` uses the extremes**, not closes — a single wick outside the
  band fails it.
- **`touches` is inclusive** at both edges (`<=`).
- **`no_close_*` look at closes only** — an intrabar spike beyond the level does
  not fail them; an hourly *close* beyond it does.
- **The *after-touch* mechanics evaluate only the FIRST touching bar.** Once a
  later-untouched threshold is crossed, only that first bar's close decides the
  verdict; subsequent bars are irrelevant. If the `touch` level is never reached,
  the verdict is `NT`, not `N`.

Each mechanic is unit-tested in
`scripts/test_score_report.py::TestScoringMechanics` (including the `NT` on empty
bars and the `UNKNOWN(...)` guard).

## The setup grader (`score_setup`)

`score_setup(s, bars)` answers two questions about the primary setup: did the
**entry zone fill**, and did **T1 or the invalidation come first**? Returns a
`(filled, outcome)` pair.

- No setup or no bars → `("no", "n/a")`.
- **Fill test**, walking bars in order: long fills when `b.l <= entry_hi`; short
  fills when `b.h >= entry_lo`. If never filled → `("no", "n/a")`.
- From the fill bar onward:
  - long: `b.l <= invalidation` → `("yes", "invalidation-first")`;
    `b.h >= t1` → `("yes", "t1-first")`.
  - short: `b.h >= invalidation` → `("yes", "invalidation-first")`;
    `b.l <= t1` → `("yes", "t1-first")`.
  - whichever is hit first wins (the loop returns on the first match).
- Filled but neither T1 nor invalidation reached by window end →
  `("yes", "open-at-window-end")`.

`score_setup` uses only `direction, entry_lo, entry_hi, invalidation, t1` — it does
**not** use `t2` (which is why the predictions file omits `t2`; see
[prediction-files.md](prediction-files.md)). Tested in
`test_score_report.py::TestScoreSetup` (t1-first, invalidation-first, never-fills,
open-at-window-end).

## Manual predictions — `--manual` + `validate_manual` safety

A `manual` prediction (P6) is graded `MANUAL` and is resolved by a human via
`--manual P6=Y|N|NT`. The safety design (so a typo can never freeze a wrong verdict
into the append-only ledger):

1. **Arg parsing** (`parse_args`) rejects any verdict not in `{Y, N, NT}` (exit 2).
2. **`validate_manual(overrides, predictions)`** runs *before any ledger write*: it
   collects the ids of all `manual`-type predictions in the file and exits 2 if any
   `--manual` id is not among them (whether the id doesn't exist, or exists but is
   not manual-type). The error lists the valid manual ids.
3. Only after validation does `main` do `results.update(opts["manual"])`, applying
   the verdicts to manual-type ids exclusively.

Unresolved manuals stay `MANUAL` and are excluded from the hit rate. Tested in
`test_score_report.py::TestManualValidator` (unknown id → exit 2; non-manual id →
exit 2; valid manual id → no raise) and `TestParseArgsManual`.

## `--dry-run`

Computes and prints the full summary (results, hit rate, setup outcome, cumulative
ledger figures, and the calibration block if applicable) but **writes nothing** to
the ledger — it prints `DRY RUN - ledger not written` and simulates the new row in
memory for the cumulative summary. `test_score_report.py::TestAppendOnlyLedger::test_dry_run_writes_nothing`
asserts the ledger file is not even created.

## `--force`, and the two guards

### Window-open guard

If `now < window_end_utc`:

- without `--force`: prints `window still open until <...> UTC - not scored
  (use --force for a partial score)` and **returns (exit 0)** without writing.
- with `--force`: sets `partial = True`, clamps the effective window end to `now`,
  and scores the bars available so far.

### CSV-coverage guard

The scorer must not grade on stale data. Two failures:

1. **No bars in window** — prints `no bars found in window - refresh the hourly CSV
   first:` followed by the refresh command, then `exit 3`.
2. **CSV stops too early** — if the last bar is more than `TAIL_TOLERANCE_MIN`
   (**75 minutes** — one hourly bar, stamped at bar-open, plus slack) short of the
   window end:
   - without `--force`: prints the gap, the refresh command, and the note that you
     should `--force` *only* if the market genuinely closed early (holiday/half-day);
     then `exit 3`.
   - with `--force`: sets `partial = True` and scores the available bars.

### The refresh command it prints

Both coverage failures print a ready-to-run `scripts/intraday.py` invocation built
from the file's own fields (so you can copy-paste it):

```
python scripts/intraday.py <symbol> --name <csv-stem-without-_hourly> [--roll-utc <roll_utc>]
```

`<symbol>` comes from `p["symbol"]` (or `<SYMBOL>` if absent), the `--name` is the
CSV filename with `_hourly.csv` stripped, and `--roll-utc` is included only when
`roll_utc` is set. After refreshing the CSV, re-run the scorer.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Scored successfully, **or** the window is still open and was not scored. |
| `2` | Argument / validation error (bad flag, bad `--manual` verdict, unknown/non-manual `--manual` id). Raised *before* any ledger write. |
| `3` | The hourly CSV does not cover the window (no bars, or stops >75 min short). Refresh via `scripts/intraday.py`, then retry. |

(Documented in the `score_report.py` module docstring.)

## The ledger write (append-only)

After grading, `main` builds one row and — unless `--dry-run` — appends it:

- `LEDGER.parent.mkdir(parents=True, exist_ok=True)` ensures `ledger/` exists.
- If the file does not yet exist, it writes the **header** (`LEDGER_COLS`) first —
  so the first scored report *creates* `ledger/outcome_ledger.csv` and its header.
- It opens the file in append mode (`"a"`) and writes exactly **one** row.

It never rewrites or reorders existing rows.
`test_score_report.py::TestAppendOnlyLedger::test_two_scores_append_not_rewrite`
proves the invariant: after a second score, the file *starts with* the exact bytes
of the first, the first data row is byte-for-byte identical, and the header equals
`S.LEDGER_COLS`.

> **The row's columns, their order, the additive V2 taxonomy columns, and the
> append-only contract are documented in
> [`../ledger/outcome-scoring.md`](../ledger/outcome-scoring.md).** This doc keeps
> the *grading* detail; that doc keeps the *row* detail.

## The cumulative summary + calibration

After writing, `main` reads the whole ledger back and prints a JSON summary:
`report_id`, `partial`, `dry_run`, per-prediction `results`, `hit_rate_pct`,
`unresolved_manual`, `setup_filled`, `setup_outcome`, `ledger_reports`, and
`cumulative_hit_rate_pct`.

When the ledger holds **≥10 reports**, the summary gains a `calibration` block:
realised hit rate by *stated-confidence* bucket — `<=60` / `61-75` / `>75`. The
bucketing comes from `taxonomy.confidence_bucket` (imported at the top of
`score_report.py`, with a standalone fallback that mirrors it), and **must stay in
sync** with `web/lib/content.ts::computeCalibration` (same buckets, same ≥10
threshold). If stated confidence doesn't track realised hit rate, the confidence
rubric needs recalibrating — the recalibration itself is `calibrate.py`, in
`../confidence/` and `../ledger/`. Tested in
`test_score_report.py::TestCalibrationSummary` (None below 10 rows; buckets at 10).

## Related docs

- [overview.md](overview.md) — the two type concepts (mechanic vs archetype).
- [lifecycle.md](lifecycle.md) — when scoring runs (expired windows first).
- [prediction-files.md](prediction-files.md) — the file the scorer reads.
- [taxonomy.md](taxonomy.md) — the taxonomy columns the scorer copies into the row.
- [`../ledger/outcome-scoring.md`](../ledger/outcome-scoring.md) — the ledger row
  schema + append-only design.
- `../confidence/` — `confidence.py` and `calibrate.py` (the calibration map).
