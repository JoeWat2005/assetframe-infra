# Confidence components — the four blocks

How `compute_confidence` (`scripts/confidence.py`) builds its score from four
parts, plus the measured data-quality function. Read [overview.md](overview.md)
first for the formula and the principle.

## Top-level weights

```python
WEIGHTS = {"market": 50, "ledger": 30, "catalyst": 20}   # scripts/confidence.py
raw = 50·market + 30·ledger + 20·catalyst + social_adj
```

`market`, `ledger`, `catalyst` are each in `0..1`; `social_adj` is in `-10..0`
and is added (i.e. subtracted) after the weighted blend, then the whole thing is
clamped to `0..100`. The weights are **tunable**; the module comment is explicit
that *calibration is ground truth* — the weights are heuristic defaults and the
calibration map (see [calibration.md](calibration.md)) is the mechanism that
corrects the raw blend against realised outcomes once the ledger fills.

`scripts/test_confidence.py::TestBlendWeights` asserts `sum(WEIGHTS.values()) ==
100` and that the raw score equals the weighted blend of the reported components.

---

## 1. Market — `market_confidence(analysis, setup, levels=None, options_included=False)`

A weighted mean of six sub-scores (each `0..1`). Sub-weights (also asserted to
sum to `1.0` in the tests):

| Sub-score | Weight | Function |
|---|---|---|
| trend | 0.22 | `_trend_score` |
| momentum | 0.18 | `_momentum_score` |
| structure | 0.20 | `_structure_score` |
| rr | 0.16 | `_rr_score` |
| volatility | 0.10 | `_vol_score` |
| data_quality | 0.14 | `compute_dq(...) / 10.0` |

### trend — `_trend_score(analysis)`
Reads `analysis.trend.alignment` and `analysis.trend.long_term_daily`:
- `"mixed"` in alignment → **0.4**
- `"range"` in alignment → **0.55**
- `"uptrend"` or `"downtrend"` in the long-term daily → **0.85**
- otherwise → **0.5**

### momentum — `_momentum_score(analysis, setup)`
Returns **0.5** if the setup `direction` is not `long`/`short` (e.g. `wait` or
missing). Otherwise it averages whichever of these signals are present, each
mapped *by side*:
- **Hourly RSI14** (`analysis.hourly.rsi14`): long → `clamp((rsi-40)/30)`; short →
  `clamp((60-rsi)/30)`.
- **MACD cross** (`analysis.hourly.macd.cross`): if `"bullish"`/`"bearish"`, agree
  with side → **0.8**, disagree → **0.3**.
- **MACD histogram delta** (`hist` vs `hist_prev`): expanding (`|hist| > |hist_prev|`)
  → **0.65**, else → **0.45**.
- **Daily RSI14** (`analysis.daily.rsi14`): same by-side mapping as hourly RSI.

Average of the collected points; **0.5** if none are available.

### structure — `_structure_score(analysis, setup, levels)`
Two signals, averaged:
- **Level confluence at the entry mid.** With a setup and a level list, take the
  entry mid `(entry_lo + entry_hi)/2`, a tolerance
  `tol = max(|entry_hi - entry_lo|, atr14·0.25, mid·0.001)`, count how many levels
  fall within `tol` of the mid, and score `clamp(near / 3.0)`. The level list is
  the canonical level values passed by the scaffold, or `_default_levels(analysis)`
  (classic pivots + ATR day-bands ex-open + hourly swing highs/lows) as fallback.
- **Close-inside-inner-band %** (`analysis.stats_last_sessions.close_inside_inner_band_pct`):
  scored `clamp(pct/100)`.

**0.5** if neither signal is available.

### rr — `_rr_score(setup)`
Risk:reward at the entry mid. `entry = (entry_lo + entry_hi)/2`,
`risk = |entry - invalidation|`, `rr1 = |t1 - entry| / risk`:
- `rr1 >= 2.0` → **1.0**
- `rr1 >= 1.5` → **0.8**
- `rr1 >= 1.0` → **0.55**
- otherwise → **0.3**

Returns **0.5** if the setup is missing, any of `entry_lo/entry_hi/invalidation/t1`
is non-numeric, or `risk == 0` (division guard — tested in
`TestDivisionGuards::test_rr_zero_risk`).

### volatility — `_vol_score(analysis)`
**Asset-relative** ATR normality, not an absolute cutoff (one absolute vol cutoff
can't span equities and crypto). Primary path: `ratio = atr14 / median_session_range`,
scored `clamp(1.15 - 0.5·|ratio - 1.0|)` — so ~1× (current range ≈ the instrument's
own typical session range) is "normal" and scores highest, and expanding or
contracting ranges score lower. Fallback when there is no median session range:
realised vol, `clamp(1.1 - realized_vol_20d_pct / 80.0)`. Returns **0.5** when
neither is available or the median is `0` (division guard —
`TestDivisionGuards::test_vol_zero_median`).

### data_quality — `compute_dq(...) / 10.0`
The measured data-quality score (below), scaled to `0..1`. This is the same
measure surfaced as `meta.data_quality_score` and on the source-audit / Free
"Data quality X/10" card.

---

## 2. Ledger — `ledger_confidence(ledger_context, pred_type=None)`

A Bayesian blend of realised hit rates, shrunk toward a neutral `0.5` when history
is thin. Returns `(score 0..1, detail)`.

- **No `ledger_context` → `0.5`** with reason "no ledger context (neutral prior)".
  (`scripts/test_confidence.py::TestLedgerConfidence::test_no_context_neutral`.)
- It collects up to three candidate rates, each with its sample count `n`:
  - **prediction_type** — `prediction_type_hit_rates[pred_type]`, count
    `prediction_type_counts[pred_type]`
  - **instrument** — `instrument_hit_rate`, count `historical_prediction_count`
  - **asset_class** — `asset_class_hit_rate`, count `asset_class_count`
- Each rate is normalised to `0..1` (values `>1` are treated as percentages and
  divided by 100, so `70` and `0.70` are equivalent — tested).
- **The blend** starts from a prior pseudo-count of **1 observation at 0.5**:
  ```
  num = 0.5,  den = 1.0
  for each (rate01, n):  num += rate01 · n ;  den += n
  score = clamp(num / den)
  ```
  So with little history the score sits near `0.5`; as counts grow it converges on
  the realised rates. `TestLedgerConfidence::test_shrinks_toward_half_with_low_n`
  verifies a 100% rate with `n=1` stays well below the same rate with `n=50`.
- If no candidate rates are present at all → `0.5` ("no rates (neutral prior)").

The ledger row/column schema that produces these aggregates lives in `../ledger/`
(cross-link); the aggregation itself is `ledger_context.py` (no look-ahead).

---

## 3. Catalyst — `catalyst_confidence(brief, research_pack=None)`

Thesis support from sourced catalysts/claims. **Absence of catalysts is neutral**
— a clean technical call needn't have news, so no news is *not* scored as low.

- **No `brief` → `0.5`** ("no brief"). With a brief but no claims and no source
  gaps → also `0.5`.
- **Claim support.** For each claim in `brief.claims`, the base score is looked up
  from its `status`:

  | Status | Score (`_CLAIM_STATUS_SCORE`) |
  |---|---|
  | `multiple-source` / `multi-source` / `confirmed` / `official` | **1.0** |
  | `single-source` | **0.5** |
  | `stale` | **0.3** |
  | `unverified` | **0.25** |
  | `unavailable` | **0.2** |
  | (anything unrecognised) | **0.5** (default) |

  The claim-support sub-signal is the mean of the per-claim scores.
- **Source-gaps penalty.** If `brief.news_context.source_gaps` is non-empty, add a
  signal `clamp(1.0 - 0.15·len(gaps))` — each declared gap shaves 0.15 off a
  perfect 1.0.
- The component is the mean of whichever signals are present
  (claim support, source-gaps), clamped to `0..1`.

### Research-pack traceability downgrade
When a `research_pack` is supplied, a claim is **downgraded to `min(base, 0.25)`**
only if *all* of these hold (`scripts/confidence.py`, in the claim loop):
- `c.used_in_thesis` is truthy, **and**
- its status is a **weak** status (`_WEAK_STATUSES = single-source / unverified /
  stale`), **and**
- it is **not traceable** to a research-pack item (`_claim_traced` is false).

`_claim_traced(claim, research_pack)` lowercases the claim's `source` and the
`url`/`source` of each research-pack item (under `items` or `sources`) and matches
if either string contains the other (`s in cs or cs in s`).

**Why a strong claim is never penalised:** a `multiple-source`/`confirmed`/`official`
claim already cleared the status gate, so it is deliberately *not* subject to the
traceability downgrade. Penalising it for a fuzzy string mismatch would mean adding
the research pack could *lower* confidence — a paradox the code comments call out
explicitly. Tests:
`TestCatalystConfidence::test_strong_claim_not_penalised_by_pack_mismatch` (strong
claim with no pack overlap keeps `>= 1.0`) and `test_weak_untraced_thesis_claim_downgraded`
(weak untraced thesis claim drops to `<= 0.25`).

Claim mechanics and the high-impact claim vocabulary are also enforced upstream in
`scaffold_payload.py::_claims` (it hard-fails if an `unverified`/`stale`/`unavailable`
claim is `used_in_thesis`) — see `../report-engine/` and the SKILL's "High-impact
claim gating".

---

## 4. Social adjustment — `social_adjustment(social_pack)`

**Subtract-only**, optional. Reads `social_pack.aggregate`. Returns
`(adjustment, detail)` where the adjustment is the penalty clamped to a floor of
`-10`:

| Signal | Penalty |
|---|---|
| `hype_risk == "high"` | **-5** |
| `hype_risk == "medium"` | **-2** |
| `crowding_risk == "high"` | **-3** |
| `crowding_risk == "medium"` | **-1** |
| `contrarian_warning` truthy | **-2** |

`return max(-10.0, pen)`. With no `social_pack` (or an empty one) the adjustment is
**0.0** ("no social data"). It can **never raise** confidence — it appears in the
formula as `raw + social_adj` with `social_adj <= 0`, and the result is clamped to
`0..100`. It is reported as a `components` row named `"Social adj."` with `weight: 0`.

Proven exhaustively in `scripts/test_confidence.py::TestSocialSubtractOnly`: every
combination of risks yields `<= 0`; the all-high case hits the `-10` floor; and
adding a social pack can only *lower* the published score, never raise it.

Social-pack collection and the "market conversation, never fact" labelling live in
`../social/` (cross-link). Here we document only its subtract-only confidence impact.

---

## `compute_dq(analysis, claims=None, options_included=False)` — measured data quality

A `0..10` measured score that **replaces** the old hand-set `data_quality_score`.
It feeds the Market `data_quality` sub-score (`/10`) and `meta.data_quality_score`.

Starts at **7**, then:

| Condition | Delta |
|---|---|
| `analysis.degraded` truthy | **-3** |
| `analysis.freshness.stale` truthy | **-2** |
| `analysis.freshness.age_minutes > 180` | **-1** |
| `analysis.windows.sma_warm_at_display_start` present and **not all true** | **-1** |
| `analysis.errors` truthy | **-2** |
| `options_included` true | **+1** |
| `>= 2` claims with a weak/`unavailable` status (`single-source`/`unverified`/`stale`/`unavailable`) | **-1** |

Result clamped to `0..10`. Tests in `TestComputeDQ` confirm: base 7
(`compute_dq({})`), the degraded+stale+errors floor reaching 0, the age and cold
flags each subtracting 1, the options bonus never exceeding 10, the unsupported
claims subtraction, and that it never goes below 0.

---

## Hard caps (cross-reference)

After the weighted blend + social adjustment, `compute_confidence` takes
`min(raw, lowest applicable cap)`. The full list of seven caps with exact
thresholds is documented once in [limitations.md](limitations.md#hard-caps) (the
"confidence can't exceed X when Y" reference). Each cap appends a string to
`caps_applied`, e.g. `stale_data->40`, `single_source_thesis->55`.

## Related docs

- [overview.md](overview.md) — the principle, the formula, the output object, flow
- [calibration.md](calibration.md) — how `capped` becomes `published`
- [limitations.md](limitations.md) — the hard caps + the heuristic-defaults caveat
- `../ledger/` — ledger row/column schema feeding the Ledger component
- `../predictions/taxonomy.md` — `prediction_type` (the `pred_type` keying the ledger blend)
- `../social/` — social-pack collection mechanics
