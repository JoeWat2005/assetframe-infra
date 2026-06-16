# Taxonomy — `scripts/taxonomy.py`

The one shared prediction vocabulary, with validators, asset-class and
market-regime derivation, and the confidence band/bucket helpers. Pure stdlib,
pure functions. This module is what threads a prediction through the whole
pipeline; getting its vocabulary right is what makes aggregate insights possible.

> **Why validators, not enums of strings everywhere:** the module docstring says
> it plainly — "Validators raise `TaxonomyError` on bad values so a typo can never
> silently freeze into the append-only ledger." A misspelt `prediction_type` or
> `market_regime` aborts the scaffold *before* the predictions file is written,
> rather than writing a junk value that the ledger would then preserve forever.

## Purpose

`taxonomy.py` defines the canonical sets and the helpers that map messy inputs
(session profiles, free-text regimes, raw confidence scores) onto those sets, then
assembles the validated taxonomy block that is embedded in the predictions file and
carried into the ledger and the editions table.

## The canonical sets

| Constant | Values |
|---|---|
| `PREDICTION_TYPES` | `breakout`, `rejection`, `continuation`, `mean_reversion`, `range_hold`, `volatility_expansion` |
| `DIRECTIONS` | `bullish`, `bearish`, `neutral`, `mixed` — the analyst's `directional_view` |
| `SETUP_SIDES` | `long`, `short`, `wait` — the `preferred_setup` side |
| `HORIZONS` | `intraday`, `next_session`, `multi_session` |
| `ASSET_CLASS_KEYS` | `equity`, `crypto`, `fx`, `futures`, `index`, `commodity` |
| `MARKET_REGIMES` | `trend_up`, `trend_down`, `range`, `choppy`, `high_volatility`, `low_volatility`, `breakout` |
| `CONFIDENCE_BANDS` | `Low`, `Moderate`, `Elevated`, `High` — *display* |
| `CONFIDENCE_BUCKETS` | `<=60`, `61-75`, `>75` — *statistical calibration* |

## The two "type" concepts (defined here)

The module docstring is explicit that two distinct "type" concepts must not be
confused — this is the canonical statement of the distinction also summarised in
[overview.md](overview.md):

- **PREDICTION TYPE — the archetype, defined HERE** in `PREDICTION_TYPES`: the
  strategic shape of the call (`breakout` / `rejection` / `continuation` /
  `mean_reversion` / `range_hold` / `volatility_expansion`). **One per report** — it
  tags the primary prediction and the whole edition.
- **SCORING MECHANIC — defined in `score_report.py`** (`close_above`,
  `range_inside`, `touches`, `no_close_below`, …): how an individual falsifiable
  prediction P1..Pn is graded. **`taxonomy.py` does not touch these** (the docstring
  says so), and they are unchanged by the taxonomy. See [scoring.md](scoring.md).

## Validators (`TaxonomyError`)

`TaxonomyError` is a subclass of `ValueError` (so callers may catch the broader
`ValueError`; `test_taxonomy.py::test_taxonomy_error_is_valueerror` pins this). The
private `_check(value, allowed, field)` raises `TaxonomyError(f"{field}={value!r}
is not one of {list(allowed)}")` when the value is out of set. Public validators,
one per set:

```
validate_prediction_type  validate_direction  validate_setup_side
validate_horizon          validate_asset_class  validate_market_regime
```

They are **case-sensitive and exact** — `"Breakout"`, `"bull"`, `"long"` (as a
direction), `"next session"` (with a space), `"stocks"`, `"uptrend"` (as a regime)
all raise. `test_taxonomy.py::TestValidatorsRejectTypos` covers each one.

## `asset_class_key(profile_key, symbol="", override=None)`

Returns a normalised asset class. Resolution order:

1. **`override` wins** — if provided, it is validated and returned (a bogus override
   raises `TaxonomyError`). This is the brief's `asset_class_key`.
2. **Session profile is authoritative** — `_PROFILE_ASSET_CLASS` maps the
   `sessions.py` profile to a base class:
   `us_equity_rth → equity`, `crypto_24_7 → crypto`, `fx_spot → fx`,
   `cme_futures → futures`. An unknown profile raises `TaxonomyError`.
3. **Futures refinement** — when the base is `futures` and a symbol is given, the
   root is extracted (`symbol.upper().lstrip("^").split("=")[0].split("-")[0]`) and:
   - matches `_INDEX_FUTURES` (`ES`, `NQ`, `YM`, `RTY`, `FTSE`, `DAX`, `NKD`,
     `FDAX`, `STOXX`) → `index`;
   - matches `_COMMODITY_FUTURES` (`CL`, `WTI`, `BRENT`, `BZ`, `NG`, `GC`, `SI`,
     `HG`, `PL`, `PA`, `ZC`, `ZW`, `ZS`, `ZL`, `KC`, `CT`, `SB`, `CC`, `HO`, `RB`)
     → `commodity`;
   - an unknown root (or no symbol) stays `futures`.

Tested in `TestAssetClassKey` (e.g. `ES=F → index`, `CL=F → commodity`,
`ZZZ=F → futures`, override wins and is validated, unknown profile raises).

## Market regime — derive then normalise

Regime is never pure narrative; it has a data-driven baseline.

### `derive_market_regime(analysis)`

Computes a baseline from the engine analysis JSON using **trend + structure only**
(`trend.long_term_daily`, `trend.intraday_hourly`, `trend.alignment`):

- `"range"` in alignment or intraday → `range`;
- `"uptrend"` in long-term daily and **not** `"mixed"` in alignment → `trend_up`;
- `"downtrend"` in long-term daily and not `"mixed"` → `trend_down`;
- otherwise → `choppy` (also the default for an empty analysis).

Volatility regimes (`high_volatility` / `low_volatility`) and `breakout` are
**deliberately not derived** — the docstring explains why: one absolute volatility
cutoff can't span equities and crypto, so those are left to an analyst override.
Tested in `TestRegimeDerivation` (range; trend_up; trend_up *blocked* by a mixed
alignment → choppy; default choppy).

### `normalize_market_regime(text, analysis=None)`

Maps an analyst's free-text regime onto `MARKET_REGIMES`:

1. exact label match (spaces/underscores normalised, e.g. `"high volatility"` →
   `high_volatility`);
2. else substring match against `_REGIME_ALIASES` (e.g. `"consolidation"` → `range`,
   `"calm"`/`"quiet"` → `low_volatility`, `"whipsaw"` → `choppy`, `"expansion"` →
   `breakout`);
3. else fall back to `derive_market_regime(analysis)`.

Tested in `TestRegimeDerivation` (alias as substring; exact label; unknown text
falls back to the derived baseline).

## Confidence band vs bucket — and the KEEP-IN-SYNC contract

Two different mappings of a 0-100 score, for two different purposes:

### `confidence_band(score)` — display (UI + push payloads)

```
< 50  -> "Low"      < 65 -> "Moderate"
< 80  -> "Elevated" else -> "High"
```

Unparseable input → `"Unknown"`. Boundaries are inclusive-lower: `50` is the first
`Moderate`, `65` the first `Elevated`, `80` the first `High`
(`test_taxonomy.py::test_band_boundaries` pins 49.9/50/64.9/65/79.9/80).

### `confidence_bucket(score)` — statistical calibration

```
<= 60 -> "<=60"     <= 75 -> "61-75"     else -> ">75"
```

Unparseable input → `None`. Boundaries: `60` is `<=60`, `60.1`/`75` are `61-75`,
`75.1` is `>75` (`test_bucket_boundaries`).

> **KEEP IN SYNC.** `confidence_bucket` is the single source of truth on the Python
> side; the same three buckets and the same `<10 rows` calibration threshold are
> mirrored in **three** places that must agree:
>
> - `score_report.calibration()` — imports `confidence_bucket` from here (with a
>   standalone fallback that copies the exact logic);
> - `export_content.py` — buckets ledger rows with the same inline thresholds;
> - `web/lib/content.ts::computeCalibration` — the TypeScript mirror (verified: same
>   `<=60` / `61-75` / `>75` buckets and same `rows.length < 10 → null` guard).
>
> If you change a bucket boundary here, you must change it in all four. The
> contract is asserted by `test_taxonomy.py::test_calibration_buckets_constant_shape`
> (`CONFIDENCE_BUCKETS == ("<=60", "61-75", ">75")`). The calibration *math* and
> `calibrate.py` are documented in [`../confidence/calibration.md`](../confidence/calibration.md).

The `Low/Moderate/Elevated/High` *band* and the `<=60/61-75/>75` *bucket* are
distinct concepts and must not be merged — display granularity differs from the
statistical granularity used for calibration.

## `build_taxonomy(prediction_type, direction, horizon, asset_class, market_regime)`

Validates all five fields (via the validators above) and assembles the dict:

```json
{"prediction_type": "...", "direction": "...", "horizon": "...",
 "asset_class": "...", "market_regime": "..."}
```

This is the block embedded in `data/predictions/<NAME>_predictions.json` and
carried into the ledger and the editions table. A single bad field raises
`TaxonomyError` and aborts the scaffold (`test_taxonomy.py::TestBuildTaxonomy`:
valid build; one bad field raises). Called from
`scaffold_payload.main` when assembling the predictions dict.

## `LEDGER_TAXONOMY_COLS`

```python
LEDGER_TAXONOMY_COLS = ["conf_version", "pred_type", "direction", "horizon", "market_regime"]
```

The additive ledger columns this taxonomy introduces, consumed by
`score_report.py`. (Note `asset_class` is also written to the ledger row by
`score_report.py`, alongside these — the full column list and its append-only
semantics are owned by [`../ledger/outcome-scoring.md`](../ledger/outcome-scoring.md),
not here.)

## How the taxonomy threads through the pipeline

The module docstring states the chain; this is the same loop described in
[overview.md](overview.md):

```
predictions -> ledger -> track record -> confidence -> calibration -> research memory
```

- **predictions** — `scaffold_payload` calls `asset_class_key`,
  `normalize_market_regime`, `validate_prediction_type`, and `build_taxonomy` to tag
  the edition (`scaffold_payload.main`).
- **ledger** — `score_report.py` copies `pred_type, direction, horizon,
  market_regime, asset_class` into the scored row.
- **track record** — `ledger_context.py` aggregates hit rates *by prediction type*
  (`_type_breakdown`), scoped to the instrument / asset class / globally; the web
  surfaces per-type and per-regime hit rates.
- **confidence + calibration** — the per-confidence-bucket realised hit rate feeds
  `confidence.py` and `calibrate.py`.
- **research memory** — reasoning-level learning under the same no-look-ahead rule
  (future, `research_memory.py`).

This is what enables insights like *"breakout predictions in high-volatility crypto
regimes hit 71%"* — impossible without one consistent, validated vocabulary across
every stage.

## Running it standalone

`python scripts/taxonomy.py` prints a JSON demo of the canonical sets and the
helper outputs (the `__main__` block) — handy for eyeballing the vocabulary and the
band/bucket/regime mappings.

## Test (`scripts/test_taxonomy.py`)

Pure stdlib `unittest`. Coverage:

- `TestValidatorsRejectTypos` — each validator accepts the canonical value and
  rejects typos / wrong-case / wrong-vocabulary; `TaxonomyError` is a `ValueError`.
- `TestAssetClassKey` — profile mapping, futures index/commodity refinement,
  unknown-root fallthrough, override precedence + validation, unknown profile.
- `TestRegimeDerivation` — derive range/trend_up/choppy, mixed-blocks-trend,
  default choppy; normalise via alias substring, exact label, and unknown→derived.
- `TestConfidenceBandBucket` — exact band boundaries (49.9/50/64.9/65/79.9/80),
  band on unparseable input → `Unknown`; exact bucket boundaries (60/60.1/75/75.1),
  bucket on unparseable input → `None`.
- `TestBuildTaxonomy` — valid build, one-bad-field raises, and the
  `CONFIDENCE_BUCKETS` cross-module constant shape.

Run: `python scripts/test_taxonomy.py`.

## Related docs

- [overview.md](overview.md) — the two type concepts; the threading summary.
- [prediction-files.md](prediction-files.md) — the taxonomy block in the file.
- [scoring.md](scoring.md) — the scoring mechanics (the *other* "type").
- [lifecycle.md](lifecycle.md) — where `build_taxonomy` is called.
- [`../ledger/outcome-scoring.md`](../ledger/outcome-scoring.md) — the ledger
  taxonomy columns + full row schema.
- [`../confidence/calibration.md`](../confidence/calibration.md) — `calibrate.py`
  and the calibration math behind the buckets.
- [`../confidence/components.md`](../confidence/components.md) — the confidence
  components and how the ledger feeds them.
