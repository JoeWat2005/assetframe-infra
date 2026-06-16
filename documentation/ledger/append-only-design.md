# Append-only design — the integrity model

## Purpose

The ledger is AssetFrame's proof of accountability, so its integrity model is the
product, not an implementation detail. This document explains the rules that make
"scored after the fact" **mechanical, not editorial**, and how `scripts/score_report.py`
enforces them. The column schema itself is owned by `outcome-scoring.md`; the
read-side no-look-ahead aggregation is owned there too — here we cover the *write*
side and the *evolution* of the schema.

- **File under integrity:** `ledger/outcome_ledger.csv`
- **Sole writer:** `scripts/score_report.py`
- **Readers (must tolerate the rules):** `scripts/ledger_context.py`,
  `scripts/research_memory.py`, `scripts/export_content.py`, the web app via
  `web/content/track-record.json`.

---

## The four invariants

### 1. Append-only — never edit or rewrite a row

Each scoring run appends **exactly one** row and leaves every prior row
byte-for-byte intact. There is no update path and no delete path anywhere in
`score_report.py`. The file is opened in append mode only:

- `main()` opens the ledger with `open(LEDGER, "a", …)` and a single `csv.writer`
  call writes one row (`w.writerow(row)`).
- The header is written **once**, guarded by `new_file = not LEDGER.exists()` —
  only when the file does not yet exist (see §"Day-one header write").

This is asserted directly by `scripts/test_score_report.py`
(`TestAppendOnlyLedger.test_two_scores_append_not_rewrite`): after a second score
the test checks `after_second.startswith(after_first)`, that the first data row is
unchanged (`rows_second[1] == rows_first[1]`), and that row 0 still equals
`LEDGER_COLS`.

### 2. Never reorder columns; evolve only by appending columns

`LEDGER_COLS` (in `score_report.py`) fixes the order. The **first 13** columns are
the original schema and are never reordered:

```
scored_at_utc, report_id, instrument, view, confidence, window_end_utc,
results, hits, misses, hit_rate_pct, setup_filled, setup_outcome, partial
```

The **trailing 7** are the additive V2 taxonomy/confidence columns:

```
conf_version, conf_raw, asset_class, pred_type, direction, horizon, market_regime
```

Because every reader uses `csv.DictReader` keyed by column **name** (not position),
older rows that predate the V2 columns simply lack those keys and read back as `""`
— no migration, no history rewrite. The source comment states this explicitly:
*"The trailing columns … are additive; older rows simply lack them and read back as
'' via DictReader."* This is what lets the schema evolve without ever touching an
existing row. (`calibrate.py` relies on exactly this: it reads `conf_raw` and falls
back to `confidence` for legacy rows — see `calibration.md`.)

### 3. Never score an incomplete window

A prediction window that has not closed is not scored. In `main()`:

- `now = datetime.now(timezone.utc)` and `wend = parse_dt(p["window_end_utc"])`.
- If `now < wend` and `--force` was **not** given, the script prints
  *"window still open until … — not scored (use --force for a partial score)"* and
  **returns without writing** (exit 0).
- A second guard checks the data actually reaches the window end: if the hourly CSV
  stops more than `TAIL_TOLERANCE_MIN` (75 minutes — one hourly bar stamped at
  bar-open, plus slack) short of `wend`, the script exits **3** with a refresh
  command, unless `--force` is passed.

So the only way a row exists at all is for a window that has closed (or a
deliberate, flagged early-close/partial).

### 4. Scoring-first per run → provably no look-ahead

Step 1 of the `/mvp` flow (SKILL.md) is *"Score expired ledger windows first"* —
score every `data/predictions/*_predictions.json` whose `window_end_utc` has passed
and has no ledger row, **before** generating the new report. Because the
ledger-as-input scripts (`ledger_context.py`, `research_memory.py`) then read only
rows whose `window_end_utc` is **strictly before** `--as-of` (default now), a
report can never be influenced by its own future outcome — the feedback loop is
free of look-ahead by construction. README §3 states it plainly: *"Doing this first
is what keeps history provably free of look-ahead."*

> The double guarantee: (a) a row only exists after its window closed, and (b) the
> readers additionally filter `window_end_utc < as_of`. Even a mis-stamped row
> cannot leak forward — the filter is on the window end, not on `scored_at_utc`.

---

## How `score_report.py` enforces it

| Mechanism | Where (function) | Effect |
|---|---|---|
| Append mode + single `writerow` | `main()` | One row per run, prior rows untouched. |
| Day-one header write | `main()`, `new_file = not LEDGER.exists()` | Header `LEDGER_COLS` written only when the file is first created. |
| Name-keyed reads | every reader via `csv.DictReader` | Additive columns evolve without rewriting history. |
| Open-window guard | `main()`, `if now < wend` | Refuses to score an incomplete window unless `--force`. |
| Tail-coverage guard | `main()`, `gap_min > TAIL_TOLERANCE_MIN` | Refuses (exit 3) if the CSV doesn't reach the window end unless `--force`. |
| Manual-verdict validator | `validate_manual()` | A typo'd `--manual` id exits **2 before any write**, so a wrong verdict can never be frozen in. |
| Dry-run | `parse_args()` `--dry-run`; `main()` `if not opts["dry_run"]` | Computes and prints everything, writes nothing. |

### Day-one header write

The header row is written exactly once. On the first ever score, `LEDGER.exists()`
is false, so `new_file` is true and `w.writerow(LEDGER_COLS)` runs before the data
row. On every subsequent run the file exists, `new_file` is false, and only the
data row is appended. This is why the repo currently has **no**
`ledger/outcome_ledger.csv` — nothing has been scored yet; the first
`score_report.py` run that resolves a closed window will create it with the header.

### `--force` — the only escape hatch, and only for PARTIAL

`--force` exists for exactly two legitimate situations, both of which mark the row
`partial = "yes"`:

1. **Deliberate partial score of an open window** — `now < wend` with `--force`
   sets `partial = True` and clamps the scoring window end to `now`.
2. **Genuine early close** — the market closed early (holiday/half-day) so the
   hourly CSV legitimately stops short of the nominal `wend`; `--force` accepts the
   available bars and sets `partial = True`.

`--force` does **not** let you rewrite, reorder, or delete a row. It only relaxes
the "window must be closed / data must reach the end" guard, and it stamps the
result PARTIAL so the partiality is recorded in the row itself (`partial` column).

### Manual verdicts can't corrupt the record

`type: "manual"` predictions (e.g. a macro outcome) are resolved by a human via
`--manual P5=Y[,P6=NT]` (verdicts ∈ `{Y, N, NT}`). `validate_manual()` runs
**before any ledger write**: every supplied id must exist in the predictions file
*and* be manual-type, else the script exits **2** with the list of valid manual
ids. The source comment: *"A typo must never freeze a wrong verdict into the
append-only ledger."* Unresolved manuals stay `MANUAL` and are excluded from the
hit rate. Tested by `TestManualValidator` and `TestParseArgsManual` in
`test_score_report.py`.

---

## Command examples

```bash
# Score a closed window (creates the ledger + header on the very first run):
python scripts/score_report.py data/predictions/WTI_predictions.json

# Provide a freshly refreshed hourly CSV explicitly:
python scripts/score_report.py data/predictions/WTI_predictions.json \
  --hourly data/candles/WTI_hourly.csv

# Resolve manual (human-judged) predictions while scoring:
python scripts/score_report.py data/predictions/GBPJPY_predictions.json --manual P5=Y

# See exactly what WOULD be appended, write nothing:
python scripts/score_report.py data/predictions/WTI_predictions.json --dry-run

# Deliberate PARTIAL (open window) or genuine early close — stamps partial="yes":
python scripts/score_report.py data/predictions/ES_predictions.json --force
```

Exit codes: **0** scored or window-still-open · **2** argument/validation error
(incl. a bad `--manual`) · **3** hourly CSV does not cover the window (refresh via
`scripts/intraday.py`, then retry).

---

## Edge cases

- **Open window, no `--force`:** prints a notice and returns, exit 0, no row.
- **CSV stops >75 min short, no `--force`:** exit 3 with a refresh command; no row.
- **`--dry-run`:** prints the simulated summary (the would-be row is added to the
  in-memory `rows` only, labelled "DRY RUN — ledger not written"); the file is not
  created. `test_dry_run_writes_nothing` asserts the ledger file does not exist
  afterwards.
- **Bad `--manual` id / non-manual id / bad verdict:** exit 2 before any write.
- **No bars in the window at all:** exit 3 (refresh the CSV first) — not a silent
  empty row.
- **Double-scoring the same report:** the `/mvp` flow's report_id check (SKILL.md
  steps 1 & 10) prevents re-scoring a report that already has a row; this is a
  process guard. Within a single invocation `score_report.py` writes one row.
  *NOT VERIFIED in `score_report.py` itself:* the script does not de-duplicate by
  `report_id` internally — re-running it on the same predictions file would append
  a second row. The guard against this is operational (skip files that already have
  a ledger row, per step 1). To verify, check the `/mvp` step-1 logic and any
  caller wrapper.

---

## Security / audit angle

- **Tamper-evidence by construction.** Because rows are append-only and
  name-keyed, the natural representation is also the audit log: any out-of-band edit
  to a historical row would be a manual change to a committed CSV, visible in git
  history. The ledger and `web/content/*.json` are the only engine artefacts that
  reach git/Neon (README §2); the rest of `data/` stays local/gitignored.
- **No back-fitting.** The scoring-first rule plus the strict `window_end_utc <
  as_of` read filter mean published confidence and track-record numbers cannot be
  improved by editing what a past report "predicted". The calibration map is fitted
  only on `conf_raw` (the pre-calibration score) to avoid a feedback loop — see
  `calibration.md`.
- **Validation before persistence.** Argument and manual-verdict validation happen
  before the single append, so a malformed run fails loudly (exit 2/3) rather than
  writing a corrupt or speculative row.

---

## Related tests

- `scripts/test_score_report.py` — `TestAppendOnlyLedger` (append-not-rewrite,
  dry-run writes nothing), `TestManualValidator`, `TestParseArgsManual`,
  `TestLoadBars` (inclusive window filter).

## Related docs

- `outcome-scoring.md` — the 20-column schema and how each column is filled.
- `overview.md` — the ledger's two roles and how it surfaces.
- `calibration.md` — why the fit uses `conf_raw` (no feedback loop) and the
  additive-column fallback to `confidence` for legacy rows.
- `../predictions/scoring.md` — the per-mechanic grading detail (cross-link).
