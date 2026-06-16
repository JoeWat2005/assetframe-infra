# Generation pipeline

> Part of the AssetFrame `/documentation` vault → `architecture/`.
> See also: [system-overview.md](./system-overview.md) ·
> [distribution-pipeline.md](./distribution-pipeline.md) ·
> [data-flow.md](./data-flow.md) · [trust-boundaries.md](./trust-boundaries.md) ·
> [directory-map.md](./directory-map.md)

This is the per-instrument generation flow, in order. The authoritative operating manual is
`.claude/skills/mvp/SKILL.md`; `mvp/README.md` §3 is the map. This doc grounds each step in
the actual script source.

**Two rules dominate the ordering:**

1. **Scoring runs first** so history can never see the future (the no-look-ahead guarantee —
   see [trust-boundaries.md](./trust-boundaries.md#no-look-ahead)).
2. **Human review runs last** — no edition publishes straight from the generator.

The AI authors exactly **one** artifact in this whole flow: the research brief
(`data/briefs/<NAME>_research_brief.json`). Everything else is compiled and validated by
Python.

```
score_report.py (score expired windows FIRST) → calibrate.py
  → intraday.py [--anchor live|prior-completed|friday]
  → research_pack.py
  → social_pack.py            (OPTIONAL — pipeline runs without it)
  → ledger_context.py
  → AI writes data/briefs/<NAME>_research_brief.json   (the ONLY hand-authored artifact)
  → scaffold_payload.py       (compiles payload + predictions; invokes confidence.py)
  → mvp_report.py             (renders Snapshot+Pro; QA gate; aborts on error)
  → HUMAN REVIEW (mvp_report.py <out_dir> --stamp-visual)
  → export_content.py → publish.py → web/scripts/sync-db.mjs   (distribution plane)
```

Output per run: `reports/YYYY-MM-DD/<INSTRUMENT>/` → `free.pdf`, `pro.pdf`, `free.html`,
`pro.html`, `metadata.json`, `preview.png`. `out_dir` MUST be `reports/<date>/<slug>` (the
scaffold computes this from the report date + ticker — `scaffold_payload.assemble()` line
358).

---

## Step 1 — Score expired ledger windows first

| | |
|---|---|
| **Script** | `scripts/score_report.py` then `scripts/calibrate.py` |
| **Reads** | `data/predictions/<NAME>_predictions.json`, the hourly CSV named in it (or `--hourly`), `ledger/outcome_ledger.csv` (for the cumulative summary) |
| **Writes** | appends one row to `ledger/outcome_ledger.csv`; `calibrate.py` rewrites `ledger/calibration_map.json` |

For any `data/predictions/*_predictions.json` whose `window_end_utc` has passed with no
matching ledger row, refresh that instrument's hourly CSV, resolve any `manual` predictions,
and score it. The grader (`score_prediction()`, lines 131-162) implements each scoring
mechanic: `close_above`, `close_below`, `range_inside`, `touches`, `no_close_below`,
`no_close_above`, `no_close_above_after_touch`, `no_close_below_after_touch`. The setup
grader (`score_setup()`, lines 165-189) checks whether the entry zone filled and whether T1
or the invalidation came first.

```
python scripts/score_report.py data/predictions/XAUUSD_predictions.json --dry-run
python scripts/score_report.py data/predictions/XAUUSD_predictions.json --manual P5=Y
```

- An **open window** is refused unless `--force` (lines 226-230); a CSV that stops >75 min
  short of the window end exits 3 with a refresh command (lines 242-249).
- `--dry-run` computes and prints everything, writes nothing (simulates the would-be row in
  memory for the summary, lines 282-284).
- `--manual ID=V` resolves `type:"manual"` predictions; every id must exist and be manual
  before any ledger write (`validate_manual()`, lines 121-128) so a typo can't freeze a
  wrong verdict.
- The ledger is **append-only**: the row is appended and the 20-column header
  (`LEDGER_COLS`, lines 62-66) is written only when the file is new (lines 268-275). The
  first 13 columns are the original schema; the trailing 7 (`conf_version, conf_raw,
  asset_class, pred_type, direction, horizon, market_regime`) are additive — legacy rows
  read them back as `""`.

Then refit the calibration map so the latest outcomes inform confidence:

```
python scripts/calibrate.py --dry-run
```

`calibrate.py` fits a **weighted isotonic regression** (Pool Adjacent Violators,
`pava()` lines 82-96) of realised hit-rate on the ledger's `conf_raw` (the pre-calibration
capped score; falls back to `confidence` for legacy rows), filtered to the current
`conf_version`, then **shrinks toward identity** with `w = min(1, n_rows / 40)`
(`build_map()` line 112). Below `MIN_ROWS = 5` it returns a pure identity map regardless
(lines 104-106). Exit 0 always; an empty/young ledger writes a valid identity map.

**Tests:** `scripts/test_score_report.py` (each scoring mechanic, the setup grader, the
calibration summary, the manual validator, the append-only write never rewrites existing
rows), `scripts/test_calibrate.py` (PAVA monotonicity, shrinkage-to-identity, empty/young
identity guarantees).

> **Day-one edge case.** `ledger/outcome_ledger.csv` does not exist yet (only
> `calibration_map.json` and `research_memory.json` are present). The first time
> `score_report.py` runs against an expired window it *creates* the ledger and writes the
> header. Until then `calibrate.py` produces an identity map (the on-disk
> `calibration_map.json` shows `n_rows: 0`, `method: "identity"`).

---

## Step 2 — Run the engine (with the right anchor)

| | |
|---|---|
| **Script** | `scripts/intraday.py` |
| **Reads** | Yahoo chart API (default) or EODHD (licensed; `ADVISOR_DATA_PROVIDER=eodhd` + `EODHD_API_KEY`) |
| **Writes** | `data/candles/<NAME>_hourly.csv`, `data/candles/<NAME>_daily.csv`, `data/analysis/<NAME>_analysis.json` |

```
python scripts/intraday.py GC=F --name XAUUSD --hrange 10d --anchor prior-completed --roll-utc 22
```

Pulls warm-up-extended OHLC (hourly fetch = display + 21 days; daily fetch = one range up,
e.g. `1y → 2y`, `DFETCH` line 448) and computes SMA/EMA/RSI/MACD/ATR, swings, session VWAP,
classic floor pivots, ATR day-bands, and empirical level stats, plus explicit `freshness`,
`degraded`, `provider`, and `windows` blocks. Always read those four blocks before trusting
any number (`README.md` data-source rule; `freshness_block()` lines 213-259).

`--anchor` re-derives pivots + ATR day-bands on a **chosen completed daily session** instead
of the live/in-progress one — this **replaces the old hand-built `*_anchored.json`** (lines
613-655):

- `live` (default) — pivots from the prior completed session, bands anchored on TODAY'S
  session open.
- `prior-completed` — pivots from the last completed daily session's HLC, bands anchored on
  that session's close (the normal pre-market case).
- `friday` — like `prior-completed` but the most recent completed Friday session
  (weekend / Monday pre-market); falls back to last completed.

When `--anchor != live`, `pivots_classic` / `atr_day_bands` are **overwritten** with the
anchored values (so `scaffold_payload.py` consumes them transparently), the live values are
preserved under `pivots_classic_live` / `atr_day_bands_live`, and an `anchor` block records
the choice. The shared pivot/band math is `compute_pivots_bands()` (lines 398-426) — used by
both the live and anchored paths so they're byte-for-byte identical.

**Edge cases.** With fewer than 24 hourly bars but usable daily data, the run still succeeds
with `degraded: "daily_only"` (hourly block null, pivots from the last two daily bars, lines
491-495, 535-542). If daily fails too: clear error on stderr, exit 2 (lines 484-489). The
`windows.sma_warm_at_display_start` map records per-SMA warm-up sufficiency — a cold SMA must
never drive a trend read, and it caps confidence (see
[trust-boundaries.md](./trust-boundaries.md#price-integrity--data-quality)).

**Data provider note.** Yahoo is unofficial and not licensed for commercial use; futures
(`=F`) always come from Yahoo even under EODHD; any EODHD failure falls back to Yahoo
per-fetch and is recorded in the JSON's `provider` block (`fetch_chart()` lines 185-210).

**Tests:** `scripts/test_sessions_intraday.py` exercises the pure `compute_pivots_bands()`
anchor math (golden values, division/None guards) offline — the live fetch path is never
touched.

---

## Step 3 — Build the research pack (sourcing layer)

| | |
|---|---|
| **Script** | `scripts/research_pack.py` |
| **Reads** | an AI-authored DRAFT JSON via `--in` (the script does NOT call the web) |
| **Writes** | `data/research/<NAME>_research_pack.json` |

```
python scripts/research_pack.py AAPL --in data/research/AAPL_draft.json
python scripts/research_pack.py AAPL          # no --in → emits a template skeleton to fill
```

The AI gathers macro / asset / earnings / calendar / regulatory / geopolitical context with
its own web tools, then hands a draft here; Python is the **compiler/validator**, not a web
client. **The gate** (the "AI may interpret news, never invent it" rule): every item marked
`used_in_thesis` must carry a non-empty source **and** a timestamp, else exit 2 before
anything is written (`validate()` lines 106-113). Unsourced non-thesis items are demoted into
`source_gaps[]` rather than silently kept (lines 115-116). Each item also mirrors `url` so
`confidence._claim_traced()` can trace a thesis claim back to this pack (lines 118-124). The
brief's `claims[]` are checked against this pack downstream.

---

## Step 4 — Build the social pack (OPTIONAL, subtract-only)

| | |
|---|---|
| **Script** | `scripts/social_pack.py` |
| **Reads** | an AI-authored DRAFT JSON via `--in` (does NOT call the web) |
| **Writes** | `data/social/<NAME>_social_pack.json` |

Summarises the *market conversation* — sentiment, crowding, hype/manipulation warnings. The
`aggregate` block is exactly what `confidence.social_adjustment()` consumes:
`hype_risk`, `crowding_risk` (low/medium/high) and a truthy `contrarian_warning`
(`social_pack.validate()` lines 134-143). **Entirely optional** — the whole pipeline runs
without it; `scaffold_payload.py` passes `social=None` and confidence falls through to a 0
adjustment (`social_pack.py` docstring lines 7-9). Social is **subtract-only** and never a
factual source — see [trust-boundaries.md](./trust-boundaries.md#social-is-subtract-only).

---

## Step 5 — Build the ledger context (ledger as INPUT)

| | |
|---|---|
| **Script** | `scripts/ledger_context.py` (and, across all instruments, `scripts/research_memory.py`) |
| **Reads** | `ledger/outcome_ledger.csv` |
| **Writes** | `data/ledger_context/<NAME>_ledger_context.json` (research_memory → `ledger/research_memory.json`) |

```
python scripts/ledger_context.py AAPL --ticker AAPL --asset-class equity --print
```

Writes per-instrument / asset-class / prediction-type hit rates, streaks, recent drift,
similar-setup history, and `notes_for_ai[]` (`build_context()` lines 109-168). **Hard
no-look-ahead:** it aggregates only rows whose `window_end_utc` is strictly before `--as-of`
(default now) — `load_rows()` line 56. It degrades gracefully: an empty or young ledger
yields a valid "no history yet" neutral context (`_patterns_and_notes()` lines 173-176), so
day-one runs work. The AI receives this **before** writing the brief and may cut conviction
or re-weight scenarios from history. The same file feeds `confidence.ledger_confidence()`.

`research_memory.py` is the cross-instrument analogue ("breakout in high_volatility regimes:
71%"), under the same no-look-ahead rule (`research_memory.load_rows()` line 52). It is a
pure derivation (no AI input).

**Tests:** `scripts/test_ledger_context.py` covers the no-look-ahead filter (window_end
strictly before as_of), empty-ledger degradation, and the taxonomy-scoped breakdowns shared
with confidence — for **both** `ledger_context.py` and `research_memory.py`.

---

## Step 6 — Write the research brief (the ONLY hand-authored artifact)

| | |
|---|---|
| **Author** | the AI (analyst) — not a script |
| **Writes** | `data/briefs/<NAME>_research_brief.json` |

Prose + prediction *intent* + sourced claims only — **never prices, levels, R:R, ladders, or
confidence numbers**. With the engine analysis, research pack, optional social pack, and
ledger context in front of it, the AI makes the directional call, frames the prediction
*type* and expected move in words, writes scenarios and risks, interprets news/social, and
reasons about conviction (including any ledger-driven adjustment). The full schema is in
`SKILL.md` ("The research brief schema"); a working example ships at
`data/briefs/AAPL_research_brief.json`. The scaffold rejects a brief whose `claims[]` aren't
sourced or whose intent references a price not in the engine's level set.

---

## Step 7 — Compile the payload + predictions (scaffold)

| | |
|---|---|
| **Script** | `scripts/scaffold_payload.py` |
| **Reads** | the analysis JSON, the brief, optional research/social packs, ledger context, the calibration map, and the hourly CSV |
| **Writes** | `data/payloads/<NAME>_af_payload.json`, `data/predictions/<NAME>_predictions.json` |

```
python scripts/scaffold_payload.py XAUUSD --session-profile cme_futures --check
python scripts/scaffold_payload.py XAUUSD --session-profile cme_futures        # for real
```

The compiler/validator. It:

- **builds canonical levels** from the engine analysis via a fixed id+class catalog (`r2,
  tail_hi, swing_hi, r1, inner_hi, pp, anchor, s1, inner_lo, swing_lo, s2, tail_lo`; classes
  ∈ tail|resistance|target|support|entry|invalidation), de-duped by value and sorted
  high→low (`build_levels()` lines 128-169). Every price that appears anywhere lives once
  here;
- **builds long + short conditional setups** with entry/invalidation/T1/T2 picked by
  reference to level *values* (never free-typed, so they cannot drift) and **computes R:R**
  at the zone-edge trigger, formatted to `mvp_report`'s `RR_OK` (`build_setups()` lines
  184-216, `_fmt_rr()` lines 172-181);
- **builds the ladder and `ledger_levels`** from those levels (`build_ladder()` lines
  219-233, `build_predictions_spec()` lines 236-279);
- **reads `canonical.last_price`** straight from the hourly CSV's last close, so the price
  triple-equality (CSV == canonical == header) holds *by construction* (`read_last_bar()`
  lines 71-81; consumed at line 609);
- **emits the predictions file** (P1..P6 + a `setup` block + the taxonomy block) from the
  same source as the payload, so they cannot diverge — `payload.confidence ==
  predictions.confidence` always (lines 633-644);
- **invokes `confidence.compute_confidence()`** (Step 8) and writes the same published int
  into both files (lines 625-636);
- **rejects** off-catalog prices, predictions not bound to a canonical id, claims with an
  invalid status, and any `used_in_thesis` claim whose status is unverified/stale/unavailable
  (`_claims()` lines 376-387) — and rejects pro-only vocabulary leaking into the free tier
  (`_assert_free_split()` lines 429-438).

`--check` validates the brief + would-be payload and prints the would-be confidence **without
writing** (lines 652-654). Exit 2 on a brief/validation error. **Always run `--check` first,
fix the brief, then run for real.**

Session profiles (`--session-profile`, or `session_profile` in the brief): `cme_futures`,
`fx_spot`, `crypto_24_7`, `us_equity_rth` (`sessions.PROFILES`). The scaffold copies the
session window + state fields into `meta.*` and its prose into the Pro "Asset-session rules"
section.

**Tests:** `scripts/test_scaffold_payload.py` — QA-by-construction (every setup/ladder/ledger
price is a canonical level value), the `THESIS_BLOCKED` claim-sourcing gate, the free/pro
split guard, and the level-catalog / R:R helpers.

---

## Step 8 — Confidence engine (deterministic; you explain it, you never set it)

| | |
|---|---|
| **Script** | `scripts/confidence.py` (invoked by the scaffold; `__main__` is a demo, lines 394-415) |
| **Reads** | the analysis, the primary setup, the brief, research pack, optional social pack, ledger context, calibration map |
| **Writes** | nothing directly — returns the breakdown dict the scaffold embeds in both files |

```
raw       = 50·market + 30·ledger + 20·catalyst + social_adjustment   (components 0..1; social_adj −10..0)
capped    = min(raw, <hard caps>)
published = calibrate(capped)                                          (isotonic map; identity early)
```

`WEIGHTS = {"market": 50, "ledger": 30, "catalyst": 20}` (line 32). The four blocks:

1. **Market** (`market_confidence()` lines 184-195): trend alignment, momentum
   (hourly/daily RSI14, MACD cross + histogram delta), structure/entry confluence, R:R
   quality (T1 ≥ 1.5x rewarded), asset-relative volatility normality, and measured data
   quality (`compute_dq()` lines 51-74, which replaces the old hand-set
   `data_quality_score`).
2. **Ledger** (`ledger_confidence()` lines 200-226): realised hit rate for this prediction
   type / instrument / asset class, Bayesian-shrunk toward 0.5 by sample size.
3. **Catalyst** (`catalyst_confidence()` lines 231-257): claim support, source quality,
   source gaps; a `used_in_thesis` claim whose source isn't traceable to the research pack is
   downgraded.
4. **Social adjustment** (`social_adjustment()` lines 274-291): crowding/hype/contrarian
   penalties — **subtract-only**, clamped to `−10..0`, `0` if no social data.

**Hard caps (take the min, lines 358-374):** stale data → 40 · degraded data → 50 ·
single-source/unverified high-impact thesis → 55 · hype-driven social thesis → 55 · ledger
strong historical failure pattern → 55 · cold indicators → 60 · engine errors → 65. The
result carries `components[]`, `caps_applied[]`, `raw`, `capped`, `published`, `band`,
`calibrated`, `conf_version` — fully explainable. **The AI explains the number in prose; it
never sets or overrides it.**

**Tests:** `scripts/test_confidence.py` — blend weights sum, every hard cap, social
subtract-only (never raises), calibration-map apply, `compute_dq`, determinism, division
guards.

---

## Step 9 — Prediction taxonomy (cross-cutting)

| | |
|---|---|
| **Script** | `scripts/taxonomy.py` (pure functions, invoked by the scaffold, score_report, export_content) |

Tags the primary prediction: `prediction_type ∈ breakout | rejection | continuation |
mean_reversion | range_hold | volatility_expansion`, plus `direction`, `horizon`,
`asset_class`, `market_regime` (`PREDICTION_TYPES` line 21; `build_taxonomy()` lines
188-197). Validators raise `TaxonomyError` on a typo **before** anything freezes into the
append-only ledger (`_check()` lines 82-85). `asset_class_key()` derives the class from the
session profile, refining generic futures into index/commodity (lines 114-129);
`normalize_market_regime()` maps free text onto the enum or derives it from the engine (lines
150-160). This threads predictions → ledger → track record → confidence → calibration →
research memory.

> The taxonomy `prediction_type` is the *strategic archetype* of the call (one per report);
> it is distinct from the per-prediction *scoring mechanic* in `score_report.py`
> (`close_above`, `range_inside`, …), which is unchanged (`taxonomy.py` docstring lines 6-13).

**Tests:** `scripts/test_taxonomy.py` — validators reject typos, helpers map correctly, and
the confidence band/bucket boundaries are exact.

---

## Step 10 — Generate the reports + QA gate (build aborts on failure)

| | |
|---|---|
| **Script** | `scripts/mvp_report.py` (+ `report_pdf.py` for charts/PDF, `sessions.py`) |
| **Reads** | `data/payloads/<NAME>_af_payload.json` + the candle CSVs it references |
| **Writes** | into the payload's `out_dir`: `free.pdf`, `pro.pdf`, `free.html`, `pro.html`, `metadata.json`, `preview.png` |

```
python scripts/mvp_report.py data/payloads/XAUUSD_af_payload.json
```

Renders the Snapshot (free) and Pro PDFs + HTML + `metadata.json` + `preview.png`, and runs
the QA gate (`run_qa()` lines 795-957). **The build aborts before writing artifacts on any
error.** Most V2 identity checks now pass by construction (the scaffold built them) but remain
as regression guards:

- **price triple-equality** — canonical last == hourly CSV last close == `meta.last_price`
  (lines 803-811);
- **levels ↔ setups ↔ ladder ↔ ledger identity** — every setup/ladder/ledger price must be a
  canonical level (lines 817-845);
- **R:R lint** — only the approved `RR_OK` family; no negative-looking `RR_BAD` (lines
  836-837, 857-858);
- **banned-language scan** + negation-aware `guaranteed`/`personal recommendation` (lines
  849-856);
- **free/pro split** — free chart ≤3 levels, no pivots/bands, no pro-only vocabulary (lines
  867-882);
- **high-impact claims** — valid status; unverified/stale/unavailable cannot drive thesis via
  `THESIS_BLOCKED` (lines 885-889);
- **no look-ahead** — the prediction window must not start before the latest bar (lines
  936-942);
- **session fields present** + **logo present** (lines 947-953).

Charts are warm-cropped by `report_pdf.prep_chart`; partial indicator lines are hidden or
labelled (`report_pdf.WARN`, `report_pdf.py` line 48). The QA gate detail is enumerated in
[trust-boundaries.md](./trust-boundaries.md).

---

## Step 11 — Human review (mandatory, before publish)

```
python scripts/mvp_report.py <out_dir> --stamp-visual
```

A human Reads `free.pdf`, `pro.pdf`, `preview.png` page by page (logo present, no overlap,
separate status & risk badges, simple free chart, ladder matches the tables, readable
audit/setups, unambiguous R:R, warmed indicators, claims gated, confidence explanation
matches the computed score, correct paths), then stamps `visual_inspection_passed` via
`--stamp-visual`. This is the final gate: AI drafts, Python validates, a human approves.

---

## Step 12 — Publish / export / sync

```
python scripts/export_content.py
python scripts/publish.py
(cd web && npm run sync-db)
```

Export content to `web/content/*.json`, upload free + Pro files to private R2, sync the DB
(both Neon branches). Full detail — what reaches git/Neon vs R2, the signed-URL gate, the
`out_dir` nesting rule — is in [distribution-pipeline.md](./distribution-pipeline.md).

---

## Edge cases at a glance

| Situation | Behaviour | Where |
|---|---|---|
| **Day-one / empty ledger** | `outcome_ledger.csv` absent → `score_report.py` creates it on first append; `ledger_context`/`research_memory` return neutral "no history" context; `calibrate.py` writes an identity map | `score_report.py` 270-274, `ledger_context.py` 51/173-176, `calibrate.py` 104-106 |
| **Degraded data** | `<24` hourly bars → `degraded: "daily_only"`, hourly block null, pivots from daily bars; caps confidence ≤50 | `intraday.py` 491-495, `confidence.py` 360-361 |
| **Stale data** | unambiguous staleness sets `freshness.stale` → caps confidence ≤40 | `intraday.py` 213-259, `confidence.py` 362-363 |
| **Cold indicators** | SMA not warm at display start → caps confidence ≤60; trend never inferred from a cold SMA | `intraday.py` 660-677, `confidence.py` 364-365 |
| **`--check` before real run** | validates brief + would-be payload + prints would-be confidence, writes nothing | `scaffold_payload.py` 652-654 |
| **Unsourced thesis claim** | `research_pack.py` exit 2; `scaffold_payload.py` `die()`; `mvp_report.py` `THESIS_BLOCKED` | `research_pack.py` 106-113, `scaffold_payload.py` 383-384, `mvp_report.py` 888-889 |
| **EODHD failure** | per-fetch fallback to Yahoo, recorded in the `provider` block; futures always Yahoo | `intraday.py` 185-210 |
