# Generated artifacts — the six output files per run

Each `/mvp` run produces **six** files in the payload's `out_dir`, written by `scripts/mvp_report.py` only after the QA gate passes (see [`mvp-report.md`](./mvp-report.md)). This doc describes each file, the `metadata.json` contents, the `out_dir` rule, and which artifacts go where downstream.

```
reports/YYYY-MM-DD/<INSTRUMENT>/
  free.pdf      pro.pdf
  free.html     pro.html
  metadata.json preview.png
```

(`SKILL.md` step 12 output line; `README.md` §3; `mvp/CLAUDE.md` conventions.)

## The `out_dir = reports/<date>/<slug>` rule

`out_dir` is set **by the scaffold**, not hand-typed: `assemble()` returns `out_dir: f"reports/{report_date}/{ticker}"` (`scaffold_payload.py` line 358), where `report_date = window_start_utc[:10]` and `ticker = brief.ticker.upper()`. `mvp_report.main()` reads `out_dir` straight from the payload (line 1395) and writes the artifacts there.

This must be `reports/<date>/<slug>` — `export_content.py` and `publish.py` both glob `reports/*/*/metadata.json` and derive `date`/`slug` from `meta.parent.parent.name` / `meta.parent.name`. A wrong nesting depth breaks the catalog and the R2 keys. (`README.md` §3 step 12: "`out_dir` MUST be `reports/<date>/<slug>`"; the auto-memory notes a historical nesting bug here.)

## The six files

| File | What it is | Built by |
|---|---|---|
| **`free.pdf`** | AssetFrame **Snapshot** — 1-page lead magnet PDF. fpdf2 core-font render (~20–40 KB). Brand band, chips, card grid, one chart (≤3 levels, no pivots/bands), thesis bullets, broad scenarios, timeline strip, Pro teaser, short disclaimer. **Excludes** entries/invalidation/R:R/sizing/scorecard/audit/ledger/ladder (QA-enforced). | `build_free(p)` (lines 1031–1051) |
| **`pro.pdf`** | AssetFrame **Pro** — 3–6 (up to ~7) page paid PDF. Exec header, "In plain English" box, verdict box, key-levels chip strip, daily + intraday charts + RSI, **price ladder**, **confidence gauge**, optional sentiment block, then sections (Market summary → … → Asset-session rules), Source confidence + auto **Report quality** card, glossary, full disclaimer. | `build_pro(p, qa)` (lines 1054–1121) |
| **`free.html`** | Self-contained HTML twin of the Snapshot — inline base64 logo, inline SVG chart, embedded CSS, mobile media query. Opens in any browser, prints to PDF. | `build_free_html(p)` (lines 1227–1238) |
| **`pro.html`** | Self-contained HTML twin of Pro — inline SVG charts/ladder/gauge/RSI/Fear-&-Greed, same sections as `pro.pdf`. | `build_pro_html(p, qa)` (lines 1302–1344) |
| **`metadata.json`** | The machine-readable edition record (schema below). | `build_metadata(p, qa, …)` (lines 1348–1380) |
| **`preview.png`** | First page of `free.pdf` rasterised at **130 dpi** via PyMuPDF (`fitz`). Warns and is omitted if `fitz` is unavailable. | `main()` (lines 1421–1427) |

HTML twins are byte-for-byte independent of the PDFs but mirror their content; both are self-contained so they can be served as single files from R2.

## `metadata.json` contents

`build_metadata()` starts from `p["meta"]` (the scaffold's metadata block) and augments it (lines 1348–1380). Key groups:

- **Brand / product** — `brand` ("AssetFrame"), `tagline`, `product_free` ("AssetFrame Snapshot"), `product_pro` ("AssetFrame Pro"), `report_timezone` ("Europe/London").
- **`generated_at`** — `generated_at_utc` (`…Z` ISO) and, when `zoneinfo` is available, `generated_at_report_tz` (London) (lines 1365–1367).
- **Identity / context** (from the scaffold meta) — `instrument`, `ticker`, `asset_class`(+`asset_class_key`), `venue`, `exchange_timezone`, `report_date`, `status`, `risk_rating`, `primary_bias`/`research_view`, `last_price` (display string), `data_quality_score`.
- **Session + window** — `market_session_type`, `market_open_utc`, `market_close_utc`, `next_maintenance_break`, `prediction_window_start_utc`/`_end_utc` (+ their `_report_tz` London twins), `latest_bar_timestamp_utc`(+`_report_tz`), `latest_bar_complete`, `next_major_event`.
- **Provenance** — `data_provider`, `cross_check_provider`, `price_type`, `contract_month`, `adjustment_type`, `source_gaps[]`.
- **Taxonomy fields** — `prediction_type`, `horizon`, `market_regime`, `direction_view`, `confidence_band`, `long_scenario_quality`/`short_scenario_quality`.
- **Warm-up flags** — `indicator_warmup_confirmed` (true iff no free/pro lookback warnings), `partial_indicators_hidden` (always true), and `indicator_warmup_warnings[]` when any were raised (lines 1368–1371).
- **`source_confidence` / `report_quality`** — mirrored from `pro.*` as `{label: text}` maps (lines 1373–1376). The Report quality card is auto-built from the QA gate, so metadata and the rendered card always agree.
- **Editorial flags** — `plain_english_overview_included`, `sentiment_block_included`, `chart_glossary_included`, `catalyst_status`, `optional_chart {included, reason}` (lines 1351–1357), and `qa_warnings[]` (lines 1358–1359).
- **`high_impact_claims[]`** — each `{claim, status, source, used_in_thesis}` (from the scaffold meta).
- **`qa_checks{}`** — the full boolean QA map (lines 991–1011, 1372), including `visual_inspection_passed` (starts `false`; flipped to `true` by `--stamp-visual`).
- **`paths{}`** — relative file names: `free_pdf`, `pro_pdf`, `metadata_json`, `preview_png`, `free_html`, `pro_html` (lines 1377–1379).

The metadata field names `data_quality_score` / `report_quality` map to the "source_confidence / report_quality" naming used in the SKILL; the per-edition `source_confidence` block must end with an "Overall" row (`SKILL.md` editorial-polish; consumed by `_report_quality_rows`).

## Which artifacts go where

- **To R2 (private) — all served files:** `publish.py` uploads `free.html`, `free.pdf`, `preview.png`, `pro.html`, `pro.pdf` (the `UPLOAD_FILES` set). Keys mirror `/api/report/<date>/<slug>/<name>`. `metadata.json` is **not** uploaded — it stays local and feeds the export/DB sync. See [`publish.md`](./publish.md).
- **To `web/content` — derived JSON only:** `export_content.py` reads each `metadata.json` (+ the ledger + predictions) and writes **only** `catalog.json` and `track-record.json`. **No report file is copied into `web/`** — they remain private in R2, served through the auth-gated `/api/report` route. See [`export-content.md`](./export-content.md).

So the report **bytes** live exclusively in private R2; the web app holds only metadata + paths + the track record.

## Notes / edge cases

- If `fitz` (PyMuPDF) is missing, `preview.png` is simply absent and a warning is printed — the other five files still generate (lines 1421–1427). Downstream, `publish.py`/`export_content.py` only reference files that exist on disk, so a missing preview is tolerated.
- The final stdout lists every existing artifact with its byte size, plus the lookback summary (lines 1432–1440).
- PDFs are deliberately small (core fonts embed nothing) so they upload through the Google Drive MCP connector as base64 on the advisor side (`report_pdf.py` docstring) — and stay cheap to serve from R2.

## Related docs

- [`mvp-report.md`](./mvp-report.md) — how the six files are generated + the QA gate.
- [`scaffold_payload.md`](./scaffold_payload.md) — sets `out_dir` and the `meta` block.
- [`publish.md`](./publish.md) — R2 upload of the five served files.
- [`export-content.md`](./export-content.md) — the `metadata.json` → `web/content` bridge.
- `../storage/` — R2 + `/api/report` signed-URL delivery.
