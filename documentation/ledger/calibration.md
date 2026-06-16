# Calibration (ledger side) — `calibrate.py` fits the map

## Purpose

This document covers `scripts/calibrate.py` at the **ledger level**: how it reads
the ledger, fits the realised hit-rate on the engine's raw confidence, and writes
**`ledger/calibration_map.json`**. It owns the **fitting** side — the maths that
turns scored history into a map.

It does **not** cover how the map is *applied* to a new report's score. The
application (the `calibrate(capped) → published` step inside `confidence.py`) is
owned by **`../confidence/calibration.md`** — cross-linked below. *That file is not
yet present in the repo (`documentation/confidence/` is empty); treat the cross-link
as `NOT VERIFIED` until it exists.*

- **Script:** `scripts/calibrate.py`
- **Reads:** `ledger/outcome_ledger.csv` (columns `conf_raw`, `confidence`,
  `conf_version`, `hits`, `misses`).
- **Writes:** `ledger/calibration_map.json`.
- **Run by:** step 1 of the `/mvp` flow, immediately after `score_report.py` (README
  §3 pipeline: `score_report.py → calibrate.py → calibration_map.json`).

---

## 1. What it fits, and why on `conf_raw`

The map is fitted on the **pre-calibration** score — the ledger column `conf_raw`,
the capped score *before* any map was applied — **not** on the published
`confidence`. The module docstring states the reason: fitting on `conf_raw` means
*"there is no feedback loop"* — the map can't chase its own previously-published
output. For legacy rows that predate `conf_raw`, `load_points` falls back to the
published `confidence` column.

`load_points(ledger_path, conf_version)` returns `[(raw_score, realised_rate_0_1,
weight_n), …]` for usable rows, where:

- `raw_score` = `float(conf_raw or confidence)`.
- `realised_rate_0_1` = `hits / (hits + misses)` (so a row's own realised accuracy).
- `weight_n` = `hits + misses` (rows with more graded predictions weigh more).
- Rows with `n <= 0` (nothing graded) are skipped; a non-numeric `conf_raw`/
  `confidence` is skipped.

### `conf_version` filtering

Only rows whose `conf_version` matches the current engine version are used
(`--conf-version`, default `confidence.CONF_VERSION`, which is `2`). The docstring:
*"so the old freehand-era scores don't contaminate the fit."* Pass `--conf-version
all` (or `""`) to keep every row regardless of version. Tested by
`test_filters_conf_version` and `test_conf_version_none_keeps_all` in
`test_calibrate.py`.

---

## 2. The method — PAVA isotonic + shrinkage-to-identity

`build_map(points, n_full=N_FULL, min_rows=MIN_ROWS)` does the fit. Two safety
constants: **`N_FULL = 40`** (rows at which the fit is trusted at full weight) and
**`MIN_ROWS = 5`** (below this, identity regardless).

1. **Below `MIN_ROWS` (5) → pure identity.** Returns `method: "identity"`,
   `shrinkage_w: 0.0`, `knots: [[0,0],[100,100]]` — *no* correction on noise. (Also
   the path for an empty ledger: `n_rows = 0 < 5`.)
2. **Merge duplicate x.** `_merge_duplicate_x` combines rows with the same raw score
   into one weighted observation (weighted-mean realised rate, summed weight),
   sorted ascending by x.
3. **Isotonic regression (PAVA).** `pava(ys, ws)` runs weighted Pool Adjacent
   Violators → a **monotonic non-decreasing** fit of realised rate (0..1) on
   raw score. So a higher raw score never maps to a lower fitted hit rate.
4. **Shrink toward identity.** With `w = min(1.0, n_rows / N_FULL)`, each knot is:

   ```
   published_y = (1 - w) * raw_x + w * (fitted_rate * 100)
   ```

   So with few rows the map is essentially the identity line; it only earns its
   adjustment as the ledger fills. At `n_rows ≥ 40`, `w = 1.0` and the map is the
   full isotonic fit. **Below ~10 rows the map is essentially identity.**
5. **Endpoint + monotonic-x hygiene.** Knots are forced to span `x = 0..100`
   (endpoints inserted if missing) and de-duplicated to strictly ascending x, so the
   consumer can interpolate safely. The output `method` is `"isotonic+shrinkage"`,
   with `shrinkage_w` recorded.

The clamp `_clamp(x, 0, 100)` keeps every published knot in range.

### Worked intuition

- 6 rows, `n_full=40` → `w = 6/40 = 0.15`: the fit is 85% identity, 15% realised —
  `method: "isotonic+shrinkage"`, `shrinkage_w ≈ 0.15` (tested:
  `test_at_min_rows_starts_fitting`).
- 100 rows, `n_full=40` → `w` capped at `1.0`: full-weight isotonic fit (tested:
  `test_full_weight_capped_at_one`).
- 4 rows with `min_rows=5` → identity (tested: `test_below_min_rows_is_identity`).

---

## 3. The map file shape

`build_map` returns (and `main()` writes) JSON like:

```json
{
  "version": 1,
  "conf_version": 2,
  "n_rows": 0,
  "fitted_at": "2026-06-16 14:32 UTC",
  "method": "identity",
  "shrinkage_w": 0.0,
  "knots": [[0.0, 0.0], [100.0, 100.0]]
}
```

- `version` — the map-format version (constant `1`).
- `conf_version` — the engine version the fit is scoped to (`CONF_VERSION`).
- `n_rows` — number of usable points the fit was built from.
- `method` — `"identity"` or `"isotonic+shrinkage"`.
- `shrinkage_w` — the shrinkage weight `w`.
- `knots` — `[[raw_x, published_y], …]`, ascending x spanning 0..100; a piecewise
  map from raw score to published score for the consumer to interpolate.

---

## 4. Current state — identity map, `n_rows: 0`

The ledger is empty, so `ledger/calibration_map.json` is the **identity map**
(verified in the repo): `n_rows: 0`, `method: "identity"`, `shrinkage_w: 0.0`, knots
`[[0,0],[100,100]]`, `conf_version: 2`. `calibrate.py` **always exits 0** — an
empty/young ledger writes a valid identity map rather than failing — so the day-one
pipeline runs and any new report's published confidence equals its raw confidence
until the ledger has earned an adjustment.

---

## 5. The three calibration concepts — DO NOT CONFUSE

All three live in this system; they are different objects with different jobs:

| Concept | Where | What it is | Effect |
|---|---|---|---|
| **3-bucket summary** | `score_report.py` `calibration()` | A coarse **diagnostic** printed per scoring run: realised hit rate by stated-confidence bucket (`<=60` / `61-75` / `>75`), at **≥10 rows**. | None — it just flags whether the rubric drifts. (See `outcome-scoring.md`.) |
| **Fitted calibration map** | `calibrate.py` → `calibration_map.json` | The **isotonic+shrinkage** map of realised rate on `conf_raw`. **This document.** | Adjusts **future published confidence** (applied in `confidence.py`). |
| **10-point calibration curve** | `export_content.py` → `track-record.json` | A finer **10-point** confidence-bin curve (plus a 3-bucket `calibration` object) for the web track record, gated to **≥10 rows**. | Display only — the public calibration chart. (See `track-record-export.md`.) |

The summary and the web curve are *observability*; only `calibrate.py`'s map
*changes* anything, and it changes only future scores, never the ledger.

---

## Command examples

```bash
# Refit the map from the ledger and write it (run after score_report.py):
python scripts/calibrate.py

# Preview the map without writing the file:
python scripts/calibrate.py --dry-run

# Tune the trust thresholds, or include all conf_versions:
python scripts/calibrate.py --n-full 60 --min-rows 8
python scripts/calibrate.py --conf-version all
```

Flags: `--ledger` (default `ledger/outcome_ledger.csv`), `--out` (default
`ledger/calibration_map.json`), `--conf-version` (default `CONF_VERSION`; `all`/`""`
keeps all), `--n-full` (default 40), `--min-rows` (default 5), `--dry-run`.

---

## Edge cases

- **Empty ledger / file missing:** `load_points` returns `[]`; `build_map` returns
  the identity map; exit 0. (`test_empty_is_identity`, `test_missing_file_returns_empty`.)
- **< MIN_ROWS usable rows:** identity map regardless of weight
  (`test_below_min_rows_is_identity`).
- **All rows a different `conf_version`:** filtered out → effectively empty →
  identity map for the requested version.
- **Rows with `n = 0` (only NT/MANUAL):** skipped (no realised rate to fit).
- **Violations in the data (non-monotone realised rates):** PAVA pools adjacent
  violators to their weighted mean, guaranteeing a monotone output
  (`test_monotone_non_decreasing_output`, `test_pooling_averages_violation`).
- **Same raw score on many rows:** merged into one weighted point before fitting
  (`test_combines_same_x`).

---

## Related tests

- `scripts/test_calibrate.py` — `TestPAVA` (monotonicity, pooling, weighting),
  `TestMergeDuplicateX`, `TestBuildMapIdentity` (empty / below-min-rows / at-min-rows
  shrinkage), `TestBuildMapShape` (ascending-x with endpoints, monotone y, full-weight
  cap at 1.0, `conf_version` recorded), `TestLoadPoints` (`conf_version` filtering,
  `conf_raw`→`confidence` fallback, skipping no-outcome rows).

## Related docs

- `../confidence/calibration.md` — **owns the application** of the map inside
  `confidence.py` (`raw → capped → published = calibrate(capped)`). *NOT VERIFIED —
  the `documentation/confidence/` directory is currently empty; create/verify that
  file, then confirm this cross-link.*
- `outcome-scoring.md` — the source columns `conf_raw` / `confidence` /
  `conf_version` and the distinct 3-bucket per-run summary.
- `track-record-export.md` — the distinct 10-point `calibrationCurve` for the web.
- `append-only-design.md` — why fitting on `conf_raw` (not the published score)
  avoids a feedback loop, and the additive-column fallback to `confidence`.
