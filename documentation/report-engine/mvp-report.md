# `mvp_report.py` — generator + QA gate + `--stamp-visual`

`scripts/mvp_report.py` is the final generation step: it runs a hard QA gate over the compiled payload and, if clean, renders the **Snapshot** (free) + **Pro** (paid) report pair — six artifacts — into the payload's `out_dir`. It also carries the human-review stamp. Rendering is delegated to `scripts/report_pdf.py` (imported as `rp`, line 36).

Module docstring lines 1–24 state the hard guarantees: canonical price integrity, unambiguous R:R, banned-language absence, free/pro split, claim labelling, and indicator warm-up — all enforced before any artifact is written.

## The two invocations

```
python scripts/mvp_report.py <payload.json>           # generate everything
python scripts/mvp_report.py <out_dir> --stamp-visual # set visual_inspection_passed
```

`main()` (lines 1384–1440):

- **Generate** — loads the payload (`utf-8-sig`), normalises authored dash-bullets (`_normalize_payload`, line 1397), runs `run_qa()`, prints warnings, and — **if there are errors — prints each, prints `BUILD ABORTED - no artifacts written.`, and exits 1 before creating `out_dir`** (lines 1404–1408). On success it writes the six files (below) and prints their paths + sizes.
- **Stamp** — sets `metadata.json`'s `qa_checks.visual_inspection_passed = true` and rewrites the file (lines 1385–1392). The target may be the dir or the `metadata.json` itself.

## The QA gate (`run_qa`)

`run_qa(p)` (lines 795–1012) returns `(qa_dict, errors, warnings)`. **Errors abort the build before any artifact is written; warnings are printed but do not block.** This is the regression guard for everything the scaffold built by construction, plus checks that only exist at render time. Every check, grounded in the source:

### Price integrity
- **Price triple-equality** (lines 803–810): reads the hourly CSV (`rp.read_series`) last close and asserts `|csv_last − canonical.last_price| ≤ max(0.01, last·1e-5)`. Mismatch → error.
- **`meta.last_price` non-empty** (lines 811–812) → error if blank.
- **Free chart uses the same CSV** as the pro hourly chart (lines 813–815) → warn if different.

### Levels ↔ setups ↔ ladder ↔ ledger identity (lines 817–845)
- Every setup `entry_lo/entry_hi/invalidation/t1/t2` must be in `canonical.levels` (`_num_in_levels`, lines 791–792) → error.
- Every setup `invalidation/t1/t2` must also be present **in the ladder** → error.
- Every ladder id must exist in `canonical.levels` → error.
- Every `ledger_level` must be a canonical level value → error.

### R:R rules
- **`RR_OK`** (line 62) — every `setup.rr` must match the approved family: `"T1 …x|below 1.0x; T2 …x|below 1.0x"` or `"No valid R:R - excluded"` (lines 835–837) → error on mismatch.
- **`RR_BAD`** (line 63) — catches negative-looking R:R renderings (e.g. `~-40`, `-2/-1x`, `R:R … -3`); if it matches the serialised payload → error (lines 857–858). The `qa.rr_format_unambiguous` flag requires `RR_BAD` absent **and** all setups matching `RR_OK` (lines 1003–1004).

### Banned + negated-only language (lines 847–865)
- **`BANNED`** (line 56): `sure trade`, `risk[- ]free`, `easy profit`, `you should buy`, `you should sell` — any match → error.
- **`NEGATED_ONLY`** (lines 60–61): `guaranteed` and `personal recommendation` are allowed **only** in negated/compliance form; the 34-char preceding context must match the negation regex (e.g. "no outcome is guaranteed", "not a personal recommendation"), else → error.
- **Quality-label enum** (lines 861–864): `meta.long_scenario_quality`/`short_scenario_quality`, if set, must be in `QUALITY_LABELS` = {High quality, Acceptable, Low quality, Management only, No-trade} → error otherwise.

### Free / Pro split (lines 866–882)
- The free chart must have **≤ 3 labelled levels** and **no `pivots`/`bands`** → error otherwise.
- The free tier (scanned **excluding `teaser` and `disclaimer`** — the teaser legitimately names Pro features) must not contain any pro-only token: `r:r`, `per contract`, `entry zone`, `invalidation`, `t1 `, `t2 `, `ladder`, `glossary`, `source audit`, `outcome ledger`, `hedging`, `risk math` → error.

### High-impact claims (lines 884–889)
- Each `meta.high_impact_claims[].status` must be in `CLAIM_STATUSES` (line 65) → error otherwise.
- Any claim with `used_in_thesis` true and status in `THESIS_BLOCKED` = {unverified, stale, unavailable} (line 66) → error.

### Timestamps + no-lookahead (lines 927–945)
- `prediction_window_start_utc`, `prediction_window_end_utc`, `latest_bar_timestamp_utc` must be UTC-parseable (`%Y-%m-%d %H:%M`) → error otherwise (`ok_ts`).
- **No-lookahead**: window start must be `≥ latest_bar_timestamp − 1h`, else → error (`no_look`).

### Session fields + misc
- **Session fields present** (lines 947–949): `meta.market_session_type` and `meta.market_close_utc` non-empty → error otherwise.
- **Logo present** (lines 952–953): `logo/logo_trimmed.png` must exist → error otherwise (`LOGO`, line 46).
- **`prediction_type` in taxonomy** (lines 958–965): `meta.prediction_type` must be in `taxonomy.PREDICTION_TYPES` → error; missing → warn (older payloads).
- **`payload.confidence == confidence_breakdown.published`** (lines 967–977): int-equal, else → error.
- **Social framed soft** (lines 979–989): if social-signal language (`social sentiment`, `reddit`, `crowd sentiment`, `hype`, …) appears in Pro without a soft framing phrase (`market conversation`, `sentiment context`, `soft signal`, `not a fact`) → **warn** (light heuristic, triggered only by social-as-signal language, not the scorecard's "Social adj." label).

### Warnings (non-blocking)
Missing `pro.overview` (lines 892–893), section-order regressions vs `SECTION_ORDER` (lines 894–903), ladder > 12 levels (lines 904–905), all-caps words in narrative outside the `CAPS_ALLOW` allowlist (lines 906–918), missing `catalyst_status` while thesis-driving claims exist (lines 919–922), > 2 Pro charts without a declared `meta.optional_chart` (lines 923–925), `next_major_event` empty (lines 950–951), an unlabelled incomplete last bar (lines 954–956). `main()` also adds a warn for any stripped dash-bullet markers (lines 1399–1401).

The assembled `qa` dict (lines 991–1011) is the boolean check map written into `metadata.json` (`visual_inspection_passed` starts `False`).

## Snapshot vs Pro contents

The free/pro content blocks come from the payload (built by `scaffold_payload`). The generator's builders:

- **Free PDF** `build_free(p)` (lines 1031–1051): brand band ("ASSETFRAME SNAPSHOT - FREE"), title, status/risk chips, a 2-col card grid, ONE chart (`pdf.chart`) with the plain-English `FREE_CHART_NOTE`, thesis bullets, a broad "Scenarios" block, a visual timeline strip, the Pro teaser box, and a short disclaimer.
- **Pro PDF** `build_pro(p, qa)` (lines 1054–1121): brand band ("ASSETFRAME PRO - MARKET INTELLIGENCE"), title, chips, exec card grid, the "In plain English" overview box, the Pro **verdict** box, catalyst-status line, the auto **key-levels chip strip**, the charts (daily regime + intraday hourly + RSI), the **price ladder**, the **confidence gauge**, an optional **sentiment** block (Fear & Greed gauge + table), then each section. Just before the "Source audit" section it renders the **Source confidence** card and the auto-built **Report quality** card (`_report_quality_rows`, lines 673–690, derived from the QA dict so it can never disagree with the checks). Ends with the auto **glossary** (only terms the report uses) and the Pro disclaimer.

### Snapshot exclusions (QA-enforced)

From `SKILL.md` step 6 and the free-split check: the Snapshot **excludes** entries, invalidation logic, R:R, sizing math, options ideas, the scorecard, the source audit, the outcome ledger, and the price ladder. The free chart is capped at 3 labelled levels with no pivots/bands.

### Pro inclusions

The Pro adds the price ladder, the confidence gauge, the trade-quality scorecard (from `confidence_breakdown.components`), the outcome ledger section, and the full source audit — plus the canonical section order (`SECTION_ORDER`, lines 75–79). Auto-rendered blocks (never hand-authored): key-levels chip strip, ladder %-distances + legend, the chart/levels glossary, the Fear & Greed gauge (`SKILL.md` editorial-polish section).

## HTML twins

`build_free_html(p)` (lines 1227–1238) and `build_pro_html(p, qa)` (lines 1302–1344) emit **self-contained** HTML: the logo is inlined base64 (`_logo_b64`, lines 1125–1129), charts/ladder/gauge/RSI/Fear-&-Greed are inline **SVG** (`rp.chart_svg`, `ladder_svg`, `_gauge_svg`, `_rsi_svg`, `_fg_svg`), and the CSS is the embedded `_CSS` block (lines 1167–1200) with a mobile `@media` override. They mirror the PDFs (same cards, ladder, sections, glossary) and print cleanly to PDF in a browser. The risk/status chip colours are darkened so white text clears WCAG AA 4.5:1 (lines 1207–1208, matching the web app).

## `preview.png` / fitz

After the PDFs/HTML, `main()` renders `preview.png` as the **first page of `free.pdf` at 130 dpi** using PyMuPDF (`import fitz`; `doc[0].get_pixmap(dpi=130)`, lines 1421–1427). If `fitz` is missing or errors, it prints `WARNING: preview.png failed: …` and continues (the artifact is simply absent).

## Indicator warm-up (via `report_pdf`)

Charts compute indicators on the **full warmed series** and crop to `display_days`; partial SMA/RSI lines are hidden or labelled, never silently drawn as if warm. The render collects warnings in `rp.WARN`, which `main()` resets between the free and pro builds and folds into `metadata.indicator_warmup_*` (lines 1411–1416, 1436–1439). See the warm-up extension in [`intraday.md`](./intraday.md).

## `--stamp-visual` (human-review stamp)

No edition ships straight from the generator. After a human reads `free.pdf`/`pro.pdf`/`preview.png` page-by-page against the `SKILL.md` step-12 checklist, they run `python scripts/mvp_report.py <out_dir> --stamp-visual`, which flips `qa_checks.visual_inspection_passed` to `true` in `metadata.json`. The `_report_quality_rows` card shows "Visual inspection: Stamped via --stamp-visual before release".

## Relationship to `report_pdf.py`

`scripts/report_pdf.py` is the fpdf2 native renderer (`Report(FPDF)`, core fonts → small ~20–40 KB PDFs). `mvp_report` imports it and uses:

- **`Report`** — the PDF class with `footer()`, `need()` (premium pagination), `chart()`, `rsi_panel()`, `gauge()` (lines 162–396 of `report_pdf.py`).
- **`read_series(path)`** — reads a candle CSV → row dicts (lines 63–71).
- **`render_section_html(pdf, html, …)`** — the deterministic mini-renderer for `<ul>/<li>` bullets (real glyphs, hanging indent, never a bare dash) and `<table>` via fpdf2 native tables (header fill, zebra rows, numeric right-align, whole-cell `<b>` carried to bold) (lines 455–540).
- **`chart_svg()`** — the standalone SVG used in the HTML twins (lines 795–863).
- **`prep_chart()` / `crop_index()` / `sma_line()` / `rsi_line()` / `fmt()`** — warm-crop charting helpers (lines 116–153, 74–99). `prep_chart` computes on the full series, crops to the display window, and marks each SMA `ok`/`partial`/`missing`, appending to `WARN`.
- **`S()`** — cp1252 sanitiser for core fonts (lines 51–55); **`WARN`** — the shared lookback/render warning list (line 48).

`report_pdf.py` is **not run directly for `/mvp`** — `mvp_report` imports it. It does have its own `__main__` payload contract for the advisor workflow (docstring lines 1–26; `main()` lines 543–719), distinct from the AssetFrame payload, with a `build_html_twin()` of its own. That advisor-side entry is out of scope for this section.

## Exit codes

| Exit | Condition |
|---|---|
| `0` | QA clean; six artifacts written (or stamp applied) |
| `1` | any QA **error** — `BUILD ABORTED - no artifacts written.` (lines 1404–1408) |

## Related docs

- [`generated-artifacts.md`](./generated-artifacts.md) — the six files + `metadata.json` schema + the `out_dir` rule.
- [`scaffold_payload.md`](./scaffold_payload.md) — builds the payload these checks guard.
- [`sessions.md`](./sessions.md) — supplies the session fields the QA gate requires.
- [`intraday.md`](./intraday.md) — warm-up extension behind the chart cropping.
- `../confidence/` — `confidence_breakdown` feeds the gauge + scorecard.
- `../predictions/` — `taxonomy.PREDICTION_TYPES` enum the QA gate enforces.
