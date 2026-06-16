# Confidence engine — overview

The deterministic, auditable confidence engine for AssetFrame ("Confidence V2").

## Purpose & principle

A single number — `confidence` (0–100) — is attached to every Pro edition. The
governing rule, stated in the module docstring and enforced by the pipeline:

> **The analyst EXPLAINS confidence; the engine GENERATES it. Same inputs → same
> score, every time.**

The analyst never types a confidence number. They write prose that explains *why*
the score landed where it did; `confidence.py` computes the score from machine
inputs. This replaces the old freehand era's hand-set scorecard (the "47/80
trimmed to 53/100" style number that V1 reports carried). Because the score is a
pure function of its inputs, it is reproducible and fully auditable: every
published number ships with the component breakdown and the list of caps that
fired, so a reader can see exactly how it was derived.

This document is the index for the confidence vault. It covers the formula at a
glance, where the engine is invoked, the output object, and how the published
number flows downstream. Depth lives in the sibling files.

## Real file paths

- Engine: `scripts/confidence.py` (this is the core file)
- Invoked by: `scripts/scaffold_payload.py` (`main()` → `compute_confidence(...)`)
- Display band helper: `scripts/taxonomy.py` (`confidence_band`)
- Calibration fitter: `scripts/calibrate.py` (writes `ledger/calibration_map.json`)
- Calibration map (applied input): `ledger/calibration_map.json`
- Tests: `scripts/test_confidence.py`, `scripts/test_calibrate.py`

## The formula at a glance

`compute_confidence(...)` in `scripts/confidence.py`:

```
raw       = 50·market + 30·ledger + 20·catalyst        (each component 0..1)
raw       = clamp(raw + social_adj, 0, 100)            (social_adj is -10..0, subtract-only)
capped    = min(raw, <hard caps>)                      (take the lowest applicable cap)
published = int(round(clamp(apply_calibration(capped, calib), 0, 100)))
```

- `WEIGHTS = {"market": 50, "ledger": 30, "catalyst": 20}` — top-level weights,
  defined at module scope. They are tunable; the source comment notes that
  **calibration is the ultimate ground truth**, not the weights.
- The four blocks (Market, Ledger, Catalyst, Social adjustment) are detailed in
  [components.md](components.md).
- The hard caps and `apply_calibration` are summarised below; full detail in
  [limitations.md](limitations.md) (the caps reference) and
  [calibration.md](calibration.md) (the map maths).

### CONF_VERSION

`CONF_VERSION = 2` (module constant in `scripts/confidence.py`). It was bumped from
the implicit V1 (freehand) era so that `calibrate.py` can filter the ledger to
rows produced by *this* engine and not contaminate the fit with the old hand-set
scores. Every output object and the predictions file carry `conf_version`.

## Where it is invoked (by the scaffold)

`compute_confidence` is **not** run by hand for a report. `confidence.py`'s
`__main__` block is a demo only (it loads an `AAPL_analysis.json` fixture and
prints two scenarios). In the real pipeline it is called by
`scripts/scaffold_payload.py` (step 7 in the README pipeline; the confidence step
is step 8 of the SKILL flow):

```python
# scaffold_payload.py main()
conf = conf_engine.compute_confidence(
    analysis, primary, brief, research, social,
    ledger_ctx, calib,
    options_included=brief.get("options_context_included", False),
    levels=[l["value"] for l in levels])
```

Inputs the scaffold passes:

| Argument | Source file (default) |
|---|---|
| `analysis` | `data/analysis/<NAME>_analysis.json` (the engine output) |
| `setup` (`primary`) | the setup matching the brief's `preferred_setup.side`, else the first built setup |
| `brief` | `data/briefs/<NAME>_research_brief.json` |
| `research_pack` | `data/research/<NAME>_research_pack.json` |
| `social_pack` | `data/social/<NAME>_social_pack.json` (optional) |
| `ledger_context` | `data/ledger_context/<NAME>_ledger_context.json` |
| `calib` | `ledger/calibration_map.json` |
| `levels` | the canonical level *values* the scaffold just built |

## The output object

`compute_confidence` returns a dict (verified against
`scripts/confidence.py` and the scorecard renderer):

| Key | Meaning |
|---|---|
| `market`, `ledger`, `catalyst` | each component score, 0..1, rounded to 3 dp |
| `social_adj` | the social adjustment, -10..0, rounded to 1 dp |
| `raw` | the blended score after social, clamped 0..100, 1 dp |
| `capped` | `min(raw, lowest cap)`, 1 dp |
| `published` | the final integer 0..100 after calibration + clamp |
| `band` | display band from `taxonomy.confidence_band(published)` |
| `caps_applied` | list of cap strings that fired, e.g. `"stale_data->40"` |
| `components` | list of `{name, weight, score, detail}` for Market/Ledger/Catalyst plus a `Social adj.` row with weight 0 |
| `calibrated` | bool — whether a non-empty calibration map was passed |
| `conf_version` | `CONF_VERSION` (2) |

`components` drives the Pro scorecard table; `caps_applied` makes the published
number explainable.

## How `published` flows downstream

`scaffold_payload.py` threads the result through three places:

1. **Payload** — `payload["confidence"] = conf["published"]` (top-level), and the
   full dict is stored as `payload["confidence_breakdown"]`. `meta.confidence_band`
   is set from `taxonomy.confidence_band(conf["published"])`.
2. **Predictions file** (`data/predictions/<NAME>_predictions.json`) —
   `"confidence": conf["published"]`, `"conf_version": conf["conf_version"]`, and
   crucially **`"conf_raw": conf["capped"]`**. The ledger later reads `conf_raw`
   (the pre-calibration capped score) so the calibration fit has no feedback loop —
   see [calibration.md](calibration.md).
3. **Pro scorecard** — `_scorecard_html(conf)` in `scaffold_payload.py` renders the
   `components` table, the `caps_applied` line, the headline
   *"Published confidence: X/100 (band); raw Y."*, the calibration note
   (*"applied from the ledger"* vs *"identity (too few scored rows yet)"*), and the
   tagline *"The analyst explains this score; the engine computes it."*

Note: `meta.data_quality_score` is a separate field — the scaffold calls
`compute_dq(...)` again to populate it (it is also folded into the Market
component as the `data_quality` sub-score). See `compute_dq` in
[components.md](components.md).

The display band is also surfaced on the website's reports browser as a filter
facet (`confidence-band`); see `../website/`.

## Edge cases (day-one behaviour)

- **Thin / no ledger history → neutral.** With no `ledger_context`, the Ledger
  component returns `0.5` (a neutral prior). With sparse history it shrinks toward
  `0.5`. So early reports lean on Market + Catalyst with a neutral Ledger
  contribution — not a low one. See [components.md](components.md) and
  [limitations.md](limitations.md).
- **Day-one identity calibration.** The current `ledger/calibration_map.json` is an
  identity map (`method: "identity"`, `n_rows: 0`), so `published == capped` until
  enough V2 rows accumulate. `calibrated` is reported `true` whenever *any* map is
  passed (even the identity map), so the scorecard's calibration wording keys off
  row counts, not just the flag. See [calibration.md](calibration.md).
- **No setup / no side.** Market sub-scores that depend on a setup
  (momentum, R:R) fall back to `0.5` when the setup is missing or `direction` is
  `wait`.

## Related docs

- [components.md](components.md) — the four blocks in depth + `compute_dq`
- [calibration.md](calibration.md) — the calibration application + map-fitting maths
- [limitations.md](limitations.md) — honest limitations + the full hard-caps reference
- `../ledger/` — the outcome ledger schema and the `conf_raw` / outcome columns
- `../predictions/taxonomy.md` — prediction taxonomy + the display bands / calibration buckets
- `../social/` — social-pack mechanics (here we only document the subtract-only impact)
- `../report-engine/` — how the scaffold compiles the payload around this score

## Integrity & security notes

- **Deterministic & pure stdlib.** No randomness, no network, no clock-dependence
  inside `compute_confidence`. `scripts/test_confidence.py::TestDeterminism` asserts
  identical inputs produce identical full output dicts.
- **The analyst cannot set the score.** There is no brief field that injects a
  confidence number; the scaffold computes it from data and writes the same value
  into both the payload and the predictions file, so the published number and the
  registered (scored) number cannot diverge.
- **Social can only subtract.** The social adjustment is clamped to `[-10, 0]`, so
  the market-conversation feed can never *raise* confidence — a firewall against
  hype inflating the score. Proven by
  `scripts/test_confidence.py::TestSocialSubtractOnly`.
- **No look-ahead in the inputs.** `ledger_context` aggregates only windows that
  closed before the report's as-of time (enforced upstream in `ledger_context.py`);
  the calibration map is fitted on already-scored rows. The confidence engine itself
  consumes only those pre-computed, no-look-ahead inputs.
