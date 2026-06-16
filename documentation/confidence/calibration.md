# Calibration — application & map-fitting maths

Calibration is the step that turns the capped raw score into the published score:
`published = round(clamp(apply_calibration(capped, calib), 0, 100))`. This file
owns the **application** of the map (inside `scripts/confidence.py`) and the
**maths of fitting it** (`scripts/calibrate.py`). The ledger-row detail that feeds
the fit lives in `../ledger/calibration.md` (cross-link) — don't duplicate it
here.

The core idea: instead of trusting the heuristic 50/30/20 blend to be
well-calibrated, AssetFrame *learns* the mapping from "engine score" to "realised
hit rate" off its own append-only ledger, and re-points the published number onto
that empirical curve — but only as fast as the evidence allows.

## Real file paths

- Application: `scripts/confidence.py` → `_apply_calibration(score, calib)`,
  called inside `compute_confidence`.
- Fitter: `scripts/calibrate.py` → `load_points`, `pava`, `build_map`, `main`.
- Map artifact (input to the engine, output of the fitter):
  `ledger/calibration_map.json`.
- Tests: `scripts/test_calibrate.py` (fitting), `scripts/test_confidence.py`
  (`TestApplyCalibration`).

---

## Application — `_apply_calibration(score, calib)` (in confidence.py)

Piecewise-linear interpolation through the isotonic knots written by the fitter.

- **No map, or fewer than 2 knots → identity** (returns `score` unchanged). So a
  missing/empty map, or any degenerate single-knot map, is a safe no-op. Tested:
  `TestApplyCalibration::test_identity_passthrough_when_no_map`,
  `test_fewer_than_two_knots_is_identity`.
- The knots are `[x, y]` pairs sorted ascending in `x`. With `xs = [k[0] …]`,
  `ys = [k[1] …]`:
  - `score <= xs[0]` → clamp to `ys[0]` (the first y).
  - `score >= xs[-1]` → clamp to `ys[-1]` (the last y).
  - otherwise → linear interpolation within the bracketing segment
    `[x0,x1]→[y0,y1]`:
    `y = y0 + (y1 - y0)·((score - x0)/(x1 - x0))` (with a `x1 > x0` guard).

`compute_confidence` then applies `int(round(clamp(..., 0, 100)))` to get
`published`. The identity knots `[[0,0],[100,100]]` therefore return the input
unchanged (so `published == capped`), which is the current day-one state. Tests
`test_identity_map_returns_input`, `test_linear_interpolation`, and
`test_clamps_below_first_and_above_last_knot` pin all three branches.

### The `calibrated` flag
`compute_confidence` reports `calibrated = bool(calib)` — i.e. *whether a map
object was passed at all*, not whether it actually moved the score. The day-one
identity map still sets `calibrated = true`. That's why the Pro scorecard wording
keys off **row counts** ("identity (too few scored rows yet)") rather than the bare
flag — see [overview.md](overview.md) and the scorecard renderer
`scaffold_payload.py::_scorecard_html`.

---

## Fitting — `scripts/calibrate.py`

`calibrate.py` reads the ledger, fits an isotonic curve of realised hit-rate
against the engine's pre-calibration score, shrinks it toward identity by sample
size, and writes `ledger/calibration_map.json`. It is run in step 1 of the
pipeline, right after scoring expired windows (README §3), so the map always
reflects the latest scored history. **`confidence.py` APPLIES the map;
`calibrate.py` FITS it.**

### What it fits on — `conf_raw`, not `confidence`
`load_points(ledger_path, conf_version)` reads each ledger row's **`conf_raw`**
column (the *capped, pre-calibration* score the scaffold wrote) and falls back to
the published `confidence` column only for legacy rows that predate `conf_raw`.
Fitting on the pre-calibration score is what prevents a **feedback loop** — the map
never "corrects" a number that already had a previous map applied to it.

Each usable row contributes a point `(x = conf_raw, y = hits/(hits+misses), w = hits+misses)`:
- Rows are **filtered to the current `conf_version`** (default 2): if a row's
  `conf_version` is set and differs from the target, it is skipped — so the old
  freehand-era (V1) rows can't contaminate the fit. (`--conf-version all`/`""`
  disables the filter; tested in `TestLoadPoints`.)
- Rows with no outcomes (`hits + misses <= 0`) or an unparseable score are skipped.

### Isotonic regression (PAVA) — `pava(ys, ws)`
Weighted **Pool Adjacent Violators** produces a monotonic non-decreasing fit of
realised rate against score (higher engine score should not map to a *lower*
realised hit rate). Adjacent blocks that violate monotonicity are pooled into their
weighted mean. Duplicate `x` values are first combined into one weighted
observation by `_merge_duplicate_x`. Tested in `TestPAVA` (monotonicity,
already-monotone passthrough, weighted pooling) and `TestMergeDuplicateX`.

### Shrinkage toward identity — `build_map(points, n_full=N_FULL, min_rows=MIN_ROWS)`
The fitted realised rate is blended with the identity line by a weight that grows
with the number of scored rows:

```
w = min(1, n_rows / N_FULL)                  # N_FULL = 40
published = (1 - w)·raw + w·(realised_rate·100)
```

So with few rows the map is *essentially the identity* (we never "correct" on
noise); it earns its adjustment only as the ledger fills. Guards:
- **`n_rows < MIN_ROWS` (5) → identity map** outright (`method: "identity"`,
  `shrinkage_w: 0.0`, knots `[[0,0],[100,100]]`), regardless of weight. Below ~10
  rows the shrinkage weight is so small the curve is near-identity anyway.
- At `n_full = 40` rows the fit is trusted at full weight (`w = 1.0`, capped).

`build_map` also guarantees endpoints at `x=0` and `x=100` and strictly-ascending,
de-duplicated `x` so `_apply_calibration` can interpolate safely. Tests:
`TestBuildMapIdentity` (empty and `< min_rows` → identity), `TestBuildMapShape`
(ascending x with endpoints, monotone y, weight capped at 1, `conf_version`
recorded).

### Output map shape
`build_map` writes JSON like:

```json
{ "version": 1, "conf_version": 2, "n_rows": 0,
  "fitted_at": "… UTC", "method": "identity",
  "shrinkage_w": 0.0, "knots": [[0.0, 0.0], [100.0, 100.0]] }
```

(For a fitted map `method` is `"isotonic+shrinkage"` and `knots` are the shrunk
curve.) `calibrate.py` **always exits 0** — an empty or young ledger writes a valid
identity map rather than failing.

### Usage
```
python scripts/calibrate.py [--ledger ledger/outcome_ledger.csv]
       [--out ledger/calibration_map.json] [--conf-version 2]
       [--n-full 40] [--min-rows 5] [--dry-run]
```
`--dry-run` prints the would-be map without writing. Defaults match the constants
above (`N_FULL = 40`, `MIN_ROWS = 5`, `conf_version = CONF_VERSION = 2`).

---

## Day-one state

The current `ledger/calibration_map.json` is the **identity map** (`n_rows: 0`,
`method: "identity"`, `shrinkage_w: 0.0`). Therefore:
- `apply_calibration` returns its input unchanged → `published == capped` (subject
  only to rounding/clamping).
- The Pro scorecard shows *"Calibration: identity (too few scored rows yet)"*.
- The track-record calibration buckets (`<=60` / `61-75` / `>75`,
  `taxonomy.confidence_bucket`) carry little signal until ~10 V2 rows accumulate.

How this improves and what to check as the ledger fills is covered in
[limitations.md](limitations.md).

## Integrity & security notes

- **No feedback loop** — the fit uses `conf_raw` (pre-calibration), never the
  already-mapped `confidence` value.
- **Version-isolated** — only current-`conf_version` rows are fitted, so a change of
  engine (a `CONF_VERSION` bump) cleanly resets the empirical basis.
- **Monotone & bounded** — PAVA guarantees a non-decreasing map; knots and outputs
  are clamped to `0..100`; endpoints are forced. A perverse curve can't invert the
  score ordering.
- **Conservative by construction** — shrinkage means the map can't swing wildly on a
  handful of lucky/unlucky outcomes; it converges only with sample size.
- **Append-only source** — the ledger it reads is never edited or reordered, and
  incomplete windows are never scored (see `../ledger/`).

## Related docs

- [overview.md](overview.md) — where calibration sits in the formula + the flow
- [components.md](components.md) — the raw blend the map is applied on top of
- [limitations.md](limitations.md) — near-identity early, the mixed-regime note
- `../ledger/calibration.md` — the ledger-fitting side: the `conf_raw`/`hits`/`misses`
  columns and how rows become fit points (we own the application + the map maths;
  that file owns the row detail)
- `../predictions/taxonomy.md` — `confidence_bucket` (the calibration buckets) and
  `confidence_band` (the display bands)
