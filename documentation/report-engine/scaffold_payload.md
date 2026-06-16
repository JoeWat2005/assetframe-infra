# `scaffold_payload.py` — the compiler / validator

`scripts/scaffold_payload.py` is the heart of the V2 engine's role split: it compiles the canonical report payload **and** the predictions file from **one** AI-authored research brief plus the machine analysis. The analyst writes prose, intent, and sourced claims — **never prices** — and this script binds that intent to valid, drift-proof report mechanics (module docstring lines 1–36; `README.md` §3 step 7).

> *"Automate away fragile manual JSON, not the analyst."* The numbers and structure come from here; the narrative comes from the brief.

This doc bridges the report-engine and predictions concerns. The prediction *taxonomy* itself (types, validators, bands) is documented under `../predictions/`; the confidence engine under `../confidence/`. Cross-link: [`overview.md`](./overview.md), `../predictions/overview.md`.

## What it guarantees (by construction)

From the docstring (lines 7–21):

- **Canonical levels** are built from the engine analysis (pivots / ATR bands / swings / session OHLC) via a fixed id+class catalog.
- **Setups, ladder, `ledger_levels`, and the predictions file** are all derived FROM those levels — entry/invalidation/T1/T2 are level **values** picked by reference, never free-typed, so they cannot drift.
- **R:R** is computed at the zone-edge trigger and formatted to `mvp_report`'s `RR_OK`.
- **`canonical.last_price`** is read straight from the hourly CSV's last close, so price triple-equality holds by construction.
- **Confidence** is computed by `confidence.compute_confidence` (the analyst explains it, never sets it) and written identically into the payload and predictions.

It **rejects** a brief whose claims aren't sourced or whose intent references prices not in the level set.

## CLI

```
python scripts/scaffold_payload.py <NAME> \
    [--analysis data/analysis/<NAME>_analysis.json] \
    [--brief data/briefs/<NAME>_research_brief.json] \
    [--research data/research/<NAME>_research_pack.json] \
    [--social data/social/<NAME>_social_pack.json] \
    [--ledger-context data/ledger_context/<NAME>_ledger_context.json] \
    [--calib ledger/calibration_map.json] \
    [--session-profile us_equity_rth] \
    [--out data/payloads/<NAME>_af_payload.json] \
    [--predictions data/predictions/<NAME>_predictions.json] [--check]
```

All paths default to the `data/.../<NAME>_*.json` convention (`main()` lines 593–598). `parse_args()` (lines 563–583) is explicit: an unknown argument or a flag missing its value is a fatal error.

`--analysis` and `--brief` are **required** (loaded with `required=True`, lines 593–594); the research, social, ledger-context, and calib inputs are optional (a missing optional file loads as `None`). Example from `README.md`:

```
python scripts/scaffold_payload.py XAUUSD --session-profile cme_futures --check
```

## Brief fields it consumes (required + key optional)

The brief is `data/briefs/<NAME>_research_brief.json` (example: `data/briefs/AAPL_research_brief.json`). Required:

- **`status`** and **`risk`** — checked non-empty in `main()` (lines 603–605); missing → fatal.
- **A session profile** — either `--session-profile` or `brief.session_profile`; missing → fatal (lines 600–602).

Key optional fields read across `assemble()`/`build_*`: `ticker`, `instrument`, `directional_view` (→ `taxonomy.validate_direction`), `primary_bias`, `research_view`, `long_scenario_quality`/`short_scenario_quality` (enum), `market_regime`, `primary_prediction.type`, `horizon`, `preferred_setup.side`, `manual_prediction` (→ P6), `claims[]`, `narrative.{free_bullets,free_scenarios,market_summary,long_short_view,...}`, `free_*` fields, `verdict`, `catalyst_status`, `risks[]`, `scenario_matrix`, `catalysts`, `source_confidence`, `options_context_included`, `roll_utc`, and the price-descriptor passthroughs (`price_source`, `price_type`, `contract_month`, `cross_check`, …). The brief never carries prices — they are picked from the level catalog.

## The level id + class catalog

`build_levels(analysis, last_price)` (lines 128–169) builds a **deterministic** catalog. Each candidate is added by `add(id, value, cls, label)` only if numeric, rounded to a sensible dp by `_dp()` (lines 83–90: ≥1 → 2dp, else 5dp).

Fixed ids and their source + base class (lines 144–157):

| id | Source | base `cls` |
|---|---|---|
| `r2` | `pivots_classic.R2` | resistance |
| `tail_hi` | `atr_day_bands.outer_hi` | tail |
| `swing_hi` | `max(hourly.swing_highs)` | resistance |
| `r1` | `pivots_classic.R1` | resistance |
| `inner_hi` | `atr_day_bands.inner_hi` | resistance |
| `pp` | `pivots_classic.PP` | target |
| `anchor` | `last_price` | support |
| `s1` | `pivots_classic.S1` | entry |
| `inner_lo` | `atr_day_bands.inner_lo` | entry |
| `swing_lo` | `min(hourly.swing_lows)` | entry |
| `s2` | `pivots_classic.S2` | invalidation |
| `tail_lo` | `atr_day_bands.outer_lo` | tail |

Classes are drawn from `tail | resistance | target | support | entry | invalidation` (and `trigger` is added by setups/the ladder colour map downstream). Candidates are **de-duped by value** (rounded to 4dp, first/most-specific id wins) then **sorted high→low** (lines 159–167). Returns `(levels, by_id)`.

## Setups (long + short, by reference)

`build_setups(by_id, levels)` (lines 184–216). Every price is a canonical level value; R:R is computed at the **zone-edge trigger** (reclaim above `entry_hi` for long, break below `entry_lo` for short), reproducing the house convention.

- **LONG** ("washout into the floor cluster") — requires ≥2 of (`swing_lo`,`inner_lo`,`s1`) plus `s2` and `pp`. entry zone = floor cluster min/max; `invalidation = s2`; `t1 = pp`; `t2 = r1` (if present). Reclassifies the floor ids to `entry` and `s2` to `invalidation`.
- **SHORT** ("failed bounce at the pivot") — requires both of (`pp`,`inner_hi`) plus `r1`,`s1`,`s2`. entry zone = roof min/max; `invalidation = r1`; `t1 = s1`; `t2 = s2`.

`_fmt_rr(ref, inval, t1, t2)` (lines 172–181) computes the multiples and formats the string.

## R:R computation + RR_OK format

`risk = abs(ref - inval)`. If `risk <= 0` → `"No valid R:R - excluded"`. Otherwise each target's multiple is `abs(t - ref) / risk`, formatted `"{m:.1f}x"` when `≥ 1.0`, else `"below 1.0x"`. The output string is `"T1 {…}; T2 {…}"`.

This format is exactly what `mvp_report.RR_OK` accepts (and `RR_BAD` must not match) — see [`mvp-report.md`](./mvp-report.md#rr-rules). Examples (from the tests): `"T1 2.0x; T2 3.0x"`, `"T1 below 1.0x"`, `"No valid R:R - excluded"`. **Authoring trap (from `SKILL.md`):** never place `~` directly before a negative number — write "down ~40%", not "~-40%".

## Ladder + ledger_levels

`build_ladder(levels, setups)` (lines 219–233): all level ids **except `anchor`** (kept out so it renders LAST), then any setup invalidation/t1/t2 id not already present is appended; capped at **≤ 12** ids. The anchor exclusion + 12-cap are asserted in the tests.

`build_predictions_spec()` (lines 236–279) also returns `ledger_levels` — the distinct set of canonical values every prediction references, de-duped at 4dp. The QA gate requires every `ledger_level` to be a canonical value.

## Predictions P1..P6 + taxonomy

`build_predictions_spec(by_id, brief, direction)` (lines 236–279). `bull = direction == "bullish"`. Predictions are emitted only when their referenced levels exist:

| id | `type` (scoring mechanic) | Bound to | `expect` |
|---|---|---|---|
| `P1` | `close_above` | `pp` | `bull` — session settles above/below PP |
| `P2` | `range_inside` | `tail_lo`..`tail_hi` (outer bands) | `True` — stays inside the outer bands |
| `P3` | `touches` | `r1` | `bull` — R1 touched / not touched |
| `P4` | `no_close_below` | floor (`swing_lo` or `inner_lo` or `s1`) | `True` — no hourly close below the floor |
| `P5` | `no_close_above_after_touch` | touch `r1`, level `r2` | `True` — first R1 touch doesn't close an hour above R2 (NT if untouched) |
| `P6` | `manual` | `anchor` (reference) | — only if `brief.manual_prediction` set |

These `type` values are **scoring mechanics** graded by `score_report.py`, distinct from the edition-level **prediction archetype** (`PREDICTION_TYPES`) carried in the taxonomy block — see `taxonomy.py`'s docstring and `../predictions/`.

In `main()` (lines 633–644) the predictions file also carries: `report_id`, `instrument`, `symbol`, `roll_utc`, `view`, `confidence` (= the published int), `conf_version`, `conf_raw`, the **`taxonomy`** block (`taxonomy.build_taxonomy(pred_type, direction, horizon, asset_class, regime)`), `window_start_utc`/`window_end_utc` (from the session), `hourly_csv`, `predictions` (P1..Pn), and a `setup` summary (the primary setup's direction/entry/inval/t1).

## last_price from CSV → triple-equality

`read_last_bar(csv_path)` (lines 71–81) reads the **last data row** of the hourly CSV (col0 = ts, col4 = close), rounds via `_dp()`, and returns `(last_close, last_ts_utc_str)`. This value becomes:

- `canonical.last_price.value` (line 295),
- the `anchor` level value (`build_levels` line 151),
- the basis for `meta.last_price` (line 328).

So the price the header shows, the price in `canonical`, and the CSV's last close are **the same number by construction** — `mvp_report`'s price triple-equality check then passes as a regression guard.

## Confidence invocation; payload.confidence == predictions.confidence

`main()` selects the primary setup (the one matching `brief.preferred_setup.side`, else the first; lines 623–624) and calls:

```python
conf = conf_engine.compute_confidence(analysis, primary, brief, research, social,
                                      ledger_ctx, calib,
                                      options_included=brief.get("options_context_included", False),
                                      levels=[l["value"] for l in levels])
```

`conf["published"]` is written into **both** `payload["confidence"]` (assemble line 359) **and** `predictions["confidence"]` (line 636). `mvp_report` then asserts `payload.confidence == confidence_breakdown.published`. The scorecard is rendered from `conf["components"]` (`_scorecard_html`, lines 529–541). `compute_dq()` produces the data-quality score (line 290). The AI **explains** the number; the engine **computes** it. (Engine details under `../confidence/`.)

## Every rejection rule (exit 2)

`die(msg)` prints `ERROR: …` and raises `BriefError(SystemExit(2))` (lines 60–66). The rejections:

1. **Missing required input** — `--analysis`/`--brief` file absent (`load_json(required=True)`, lines 114–124).
2. **Invalid JSON** in any loaded file (line 122).
3. **No session profile** (lines 600–602).
4. **Missing `status` or `risk`** in the brief (lines 603–605).
5. **No data rows** in the hourly CSV (`read_last_bar`, line 79).
6. **Invalid claim status** — must be one of `confirmed | multiple-source | single-source | unverified | stale | unavailable` (`_claims`, lines 376–384).
7. **THESIS_BLOCKED claim** — any claim with `used_in_thesis` true whose status is `unverified`/`stale`/`unavailable` (lines 383–384). This is the claim-sourcing gate.
8. **Free-split violations** via `_assert_free_split()` (below).
9. **Taxonomy validation** — `validate_direction`, `validate_prediction_type`, `asset_class_key`, `validate_market_regime` raise `TaxonomyError` on a bad value (lines 612, 617–620, 638).

(Off-catalog prices in setups/ladder/ledger are prevented **by construction** here — they are picked from `by_id` — and re-checked as a hard error in `mvp_report`'s QA gate.)

## Free-split guard `_assert_free_split`

`PRO_ONLY` tuple (lines 425–426): `"r:r", "per contract", "entry zone", "invalidation", "t1 ", "t2 ", "ladder", "glossary", "source audit", "outcome ledger", "hedging", "risk math"`.

`_assert_free_split(free)` (lines 429–437) serialises the free tier **excluding** `teaser` and `disclaimer` (the teaser legitimately names Pro features), lowercases it, and rejects the build if any `PRO_ONLY` token appears. It also rejects a free chart with **more than 3 levels** (`support` + `resistance`) or that carries `pivots`/`bands`. This is the author-side mirror of the QA gate's free/pro split check in `mvp_report`.

## `--check`

`--check` validates the brief + would-be payload and prints the would-be confidence summary **without writing anything** (lines 652–654; docstring lines 34–35). The summary includes `name`, `confidence`, `raw`, `band`, `caps`, `pred_type`, and counts of levels/setups/predictions. Run it first (`SKILL.md`/`README.md` recommend `--check` before the real build).

## Exit codes

| Exit | Condition |
|---|---|
| `0` | success — writes `data/payloads/<NAME>_af_payload.json` + `data/predictions/<NAME>_predictions.json` (each with a trailing newline), prints the summary |
| `2` | any rejection above; also usage error with no `<NAME>` (lines 587–589) and any `parse_args` error |

`--check` exits 0 after printing the check summary (nothing written).

## Payload shape (what assemble emits)

`assemble()` (lines 284–361) returns: `report_id` (`AF-YYYYMMDD-<TICKER>`), `title`, `subtitle`, `status`, `risk`, `confidence`, **`out_dir` = `reports/{report_date}/{ticker}`** (line 358 — the canonical output location), `confidence_breakdown` (the full `conf` object), `canonical` (`last_price` object + `levels` + `setups` + `ladder` + `ledger_levels`), `meta` (the full metadata block consumed by `mvp_report.build_metadata`), and `free`/`pro` (the rendered-content blocks). The Free tier is assembled by `build_free()` (lines 390–422, which runs `_assert_free_split`) and Pro by `build_pro()` (lines 440–488).

The two disclaimers are constants: `DISCLAIMER_FREE` and `DISCLAIMER_PRO` (lines 52–57) — the tests assert "Not personal financial advice" / "never places trades" are present.

## Tests

`scripts/test_scaffold_payload.py` (run: `python scripts/test_scaffold_payload.py`):

- **`TestLevelCatalog`** — levels sorted high→low and de-duped; every level has id/cls/label; `anchor` value == `last_price`.
- **`TestQAByConstruction`** — every setup/ladder/ledger price is a canonical level value; ladder ids all canonical, ≤12, and exclude `anchor`; ladder contains every setup target + invalidation; ledger levels distinct + canonical.
- **`TestRRFormatting`** — zero-risk → "No valid R:R - excluded"; sub-1.0 → "below 1.0x"; normal multiples ("T1 2.0x; T2 3.0x").
- **`TestClaimSourcingGate`** — weak thesis claim (unverified/stale/unavailable + `used_in_thesis`) raises exit 2; invalid status raises exit 2; strong (multiple-source) thesis claim allowed; weak claim OK when not in thesis.
- **`TestFreeProSplit`** — clean free passes; pro-vocab leak (r:r / invalidation / ladder / source audit / outcome ledger) blocked; teaser may name Pro features; free chart with >3 levels or with pivots blocked.
- **`TestDisclaimers`** — both disclaimer constants present.

## Related docs

- [`overview.md`](./overview.md) — where the scaffold sits in the pipeline.
- [`intraday.md`](./intraday.md) — supplies `pivots_classic`, `atr_day_bands`, `hourly.swing_*`, `files.hourly_csv`.
- [`sessions.md`](./sessions.md) — supplies the prediction window via `get_session()`.
- [`mvp-report.md`](./mvp-report.md) — consumes the payload; the QA gate re-checks levels↔setups↔ladder↔ledger identity, R:R format, free/pro split, claim gating, confidence equality.
- `../predictions/overview.md` — the prediction taxonomy and scoring mechanics (`taxonomy.py`, `score_report.py`).
- `../confidence/` — `compute_confidence` / `compute_dq`.
