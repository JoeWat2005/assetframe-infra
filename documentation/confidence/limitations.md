# Confidence — limitations & the hard-caps reference

An honest account of what the deterministic confidence engine
(`scripts/confidence.py`) can and cannot do today, plus the canonical list of the
seven hard caps. The editorial rule (SKILL step 8) is that the analyst **explains**
this score and **never sets** it — including being candid in prose about these
limitations rather than over-reading the number.

## Honest limitations

### 1. Calibration is near-identity until the ledger fills
The calibration map is currently the **identity map** (`ledger/calibration_map.json`:
`n_rows 0`, `method "identity"`, `shrinkage_w 0.0`), so `published == capped` — the
engine's raw blend is published essentially as-is. The shrinkage weight is
`w = min(1, n_rows/40)` with a hard identity floor below `MIN_ROWS = 5`:
- below ~5 V2 rows → pure identity,
- below ~10 rows → so heavily shrunk it is effectively identity,
- ~40 rows → the empirical curve is trusted at full weight.

So the "self-calibrating" property is real but **latent**: it only starts to bite
once a few dozen scored V2 windows exist. See [calibration.md](calibration.md).

### 2. Calibration buckets show little signal early (the mixed-regime note)
The track record buckets confidence into `<=60` / `61-75` / `>75`
(`taxonomy.confidence_bucket`) and shows predicted-vs-realised per bucket. Two
issues early on:
- **Mixed regimes.** Historical ledger rows keep their *old freehand* scores from
  the V1 era; `conf_version` lets `calibrate.py` filter the fit to V2 rows, but the
  displayed buckets can still mix eras depending on what is surfaced. Until enough
  **V2** rows accumulate, the analyst should *say so* rather than over-read the
  calibration block.
- **Small samples.** With few scored rows the per-bucket hit rate is dominated by
  noise. The website only treats the calibration curve as meaningful at **>= 10
  rows** (README §7 / SKILL step 1), and the Pro scorecard says *"identity (too few
  scored rows yet)"* until then.

### 3. The top-level weights are heuristic defaults
`WEIGHTS = {market:50, ledger:30, catalyst:20}` are chosen by hand. The module
comment is explicit that **calibration is the ultimate ground truth** — the weights
are a reasonable prior, and the calibration map is the mechanism that corrects the
blend against reality. But that correction needs data (see #1), so until the ledger
fills, the 50/30/20 split is doing most of the work and is not itself empirically
validated.

### 4. The market sub-scores are heuristic thresholds
Every Market sub-score uses hand-tuned breakpoints, not fitted parameters:
- `_trend_score`: 0.4 / 0.55 / 0.85 / 0.5 buckets.
- `_momentum_score`: RSI mapped via `(rsi-40)/30`; MACD agree 0.8 / disagree 0.3;
  histogram expand 0.65 / contract 0.45.
- `_structure_score`: confluence scored `near/3.0` within an ATR-relative tolerance.
- `_rr_score`: 2.0 / 1.5 / 1.0 R:R ladders to 1.0 / 0.8 / 0.55 / 0.3.
- `_vol_score`: `1.15 - 0.5·|ratio-1|` around a 1× ATR-to-median band.

These are sensible defaults grounded in the engine's own outputs, but they are
**judgement calls, not learned coefficients**. They are documented in full in
[components.md](components.md).

### 5. Social is intentionally one-directional
The social adjustment can only **reduce** confidence (clamped `[-10, 0]`); it can
never raise it. This is deliberate — the market-conversation feed is a soft,
manipulable signal and is firewalled from being a factual upside driver
(`scripts/test_firewall.py` proves marketing metrics can't reach scoring). The
trade-off: genuine, well-founded positive sentiment gives the score no credit. By
design.

### 6. The hard caps are conservative floors, not fine-grained
The caps (below) are blunt ceilings: when a data-quality or thesis-integrity
problem is present, the published number is forced down to a fixed value
regardless of how strong the rest of the blend is. They protect against
over-confident publishing, but they don't *grade* the severity — a barely-stale
feed and a badly-stale feed both cap at 40.

### 7. No look-ahead means early reports lean on Market + Catalyst
The Ledger component returns a **neutral 0.5** with no history and shrinks toward
0.5 when history is thin (`ledger_confidence`). Combined with the no-look-ahead
rule (the ledger aggregates only windows closed before the as-of time), this means
**early editions' confidence is driven mostly by Market and Catalyst, with Ledger
sitting neutral** — not low, but uninformative. The track-record edge ("breakouts
in high-vol crypto hit 71%") only emerges as the ledger accumulates.

## What to check / how it improves

- As scored **V2** rows accumulate past ~10 and toward ~40, re-run
  `python scripts/calibrate.py` (it runs in pipeline step 1) and confirm
  `ledger/calibration_map.json` moves off `method: "identity"` to
  `"isotonic+shrinkage"` with a rising `shrinkage_w`.
- Watch the **per-bucket** realised hit rate on `/track-record`; once samples are
  meaningful, a well-calibrated engine shows realised rates tracking the bucket
  labels.
- The Ledger component stops sitting at 0.5 as per-instrument /
  per-asset-class / per-prediction-type counts grow (see
  [components.md](components.md)).
- If the weights are ever re-tuned, prefer letting calibration absorb systematic
  bias rather than chasing the weights by hand — the comment in `confidence.py`
  reflects this ordering.
- A `CONF_VERSION` bump resets the empirical basis: only rows tagged with the new
  version are fitted, so calibration returns to near-identity until the new engine
  re-accumulates history.

---

## Hard caps

After the weighted blend + social adjustment, `compute_confidence` computes
`capped = min(raw, lowest applicable cap)`. **Each cap is a "confidence can't exceed
X when Y" ceiling**; the lowest applicable one wins, and every cap that fires
appends a tag to `caps_applied`. Verified against `scripts/confidence.py` and
covered one-by-one in `scripts/test_confidence.py::TestHardCaps`.

| Cap (ceiling) | Condition (Y) | `caps_applied` tag | Helper / source |
|---|---|---|---|
| **50** | `analysis.degraded` truthy | `degraded_data->50` | inline check |
| **40** | `analysis.freshness.stale` truthy | `stale_data->40` | inline check |
| **60** | `analysis.windows.sma_warm_at_display_start` present and **not all true** (cold indicators) | `cold_indicators->60` | inline check |
| **65** | `analysis.errors` truthy (engine errors) | `engine_errors->65` | inline check |
| **55** | a `used_in_thesis` claim has a **weak** status (`single-source`/`unverified`/`stale`) — single-source/unverified high-impact thesis | `single_source_thesis->55` | `_has_unsupported_thesis(brief)` |
| **55** | high social `hype_risk` **AND** `brief.social_context.drives_thesis` (hype-driven thesis) | `hype_driven_thesis->55` | `_hype_thesis(brief, social_pack)` |
| **55** | ledger strong historical failure pattern: `prediction_type_hit_rates[pred_type] < 0.4` (rate normalised; `>1` treated as %) with `prediction_type_counts[pred_type] >= 5` | `ledger_failure_pattern->55` | `_ledger_failure(ledger_context, pred_type)` |

Notes:
- **Take the minimum.** `TestHardCaps::test_lowest_cap_wins` confirms that with
  stale (40) + degraded (50) + errors (65) present, the capped score is `<= 40`.
- **The ledger-failure cap needs `n >= 5`.** Below five scored predictions of that
  type a low rate does *not* trigger the cap — too little data
  (`test_ledger_failure_needs_min_5`).
- These thresholds are also listed in the SKILL (step 8 and the module docstring);
  the exact numbers above are taken from the code.
- The caps act on the raw blend *before* calibration, so calibration is applied to
  the already-capped score (`published = round(clamp(apply_calibration(capped))))`).

## Related docs

- [overview.md](overview.md) — the principle, the formula, the output object
- [components.md](components.md) — the four blocks + `compute_dq` (full sub-score detail)
- [calibration.md](calibration.md) — why calibration is near-identity today + the maths
- `../ledger/` — the append-only ledger that calibration and the Ledger component read
- `../predictions/taxonomy.md` — `confidence_band` (display) and `confidence_bucket` (calibration)
- `../social/` — the social-pack feed behind the subtract-only adjustment and the hype cap
