# Report engine — overview

The report engine is the **generation plane** of AssetFrame: the Python pipeline that turns a single AI-authored research brief plus live market data into the published **Snapshot** (free, 1 page) + **Pro** (paid, 3–6 pages) report pair, with a deterministic confidence score, a falsifiable set of predictions, and a hard QA gate.

This vault section documents the report engine specifically. Adjacent concerns have their own sections: `../confidence/` (the confidence engine), `../ledger/` (scoring + calibration), `../predictions/` (prediction taxonomy + scoring mechanics), `../research/`, `../social/`, and `../website/` (the Next.js distribution plane).

Authoritative sources for everything here:
- Operating manual / 13-step flow: `.claude/skills/mvp/SKILL.md`
- Human overview + architecture: `mvp/README.md` (§2 role split, §3 pipeline)
- AI project rules: `mvp/CLAUDE.md`

## Guiding principle (the role split)

From `README.md` §2:

> **AI = analyst / strategist / research desk. Python = compiler / validator. Ledger = memory + calibration + proof. Confidence = deterministic + auditable. Social = optional, subtract-only. Human = final reviewer. Website = trust / delivery.**

Concretely:

| Actor | Responsibility | Where |
|---|---|---|
| **AI** | Authors ONE artifact — `data/briefs/<NAME>_research_brief.json`: prose, prediction *intent*, sourced claims. **Never types a price.** | `scaffold_payload.md` (brief fields) |
| **Python compiler** | Builds every level, pivot, band, R:R, ladder, prediction, window. Reads `last_price` from the CSV. Rejects unsupported numbers/claims. | `scripts/scaffold_payload.py` → `scaffold_payload.md` |
| **QA gate** | Pre-render integrity checks; **aborts the build before any artifact is written** on any error. | `scripts/mvp_report.py` `run_qa()` → `mvp-report.md` |
| **Human** | Visual + editorial sign-off; stamps `visual_inspection_passed`. No edition ships without it. | `mvp_report.py … --stamp-visual` |

The slogan in `README.md`: *"Automate away fragile manual JSON, not the analyst."*

## The per-instrument pipeline

The full flow is the 13 steps in `SKILL.md` and the 12-row table in `README.md` §3. The scripts documented in this section, in execution order within a single report build:

1. **Data + analysis** — `scripts/intraday.py` (stdlib-only) pulls warm-up-extended OHLC and computes indicators, pivots, ATR day-bands, swings, VWAP, level stats, plus `freshness`/`degraded`/`provider`/`windows` blocks. Writes `data/candles/*.csv` + `data/analysis/<NAME>_analysis.json`. **See [`intraday.md`](./intraday.md).**
2. **Session window** — `scripts/sessions.py` `get_session(profile)` returns market state, session bounds, next maintenance break, and the **next-session prediction window**. **See [`sessions.md`](./sessions.md).**
3. *(AI authors the research brief — documented under brief fields in [`scaffold_payload.md`](./scaffold_payload.md).)*
4. **Compile** — `scripts/scaffold_payload.py` binds the brief to valid mechanics: canonical levels (fixed id+class catalog), long/short setups by reference, R:R, ladder, `ledger_levels`, the predictions file (P1..P6 + taxonomy), and invokes the confidence engine. Writes `data/payloads/<NAME>_af_payload.json` + `data/predictions/<NAME>_predictions.json`. **See [`scaffold_payload.md`](./scaffold_payload.md).**
5. **Generate + QA** — `scripts/mvp_report.py` runs the QA gate then renders the six artifacts into `out_dir`. Delegates chart/table/PDF rendering to `scripts/report_pdf.py`. **See [`mvp-report.md`](./mvp-report.md) and [`generated-artifacts.md`](./generated-artifacts.md).**
6. **Human review** — `python scripts/mvp_report.py <out_dir> --stamp-visual`.
7. **Export** — `scripts/export_content.py` writes `web/content/catalog.json` + `track-record.json` (report FILES are NOT copied — they are private in R2). **See [`export-content.md`](./export-content.md).**
8. **Publish** — `scripts/publish.py` uploads the report files to the private Cloudflare R2 bucket. **See [`publish.md`](./publish.md).**

(Step 1 of the live `/mvp` flow — *score expired ledger windows first* — runs `scripts/score_report.py`/`calibrate.py`, documented under `../ledger/`. It is sequenced first to keep the track record provably free of look-ahead.)

## Shared infrastructure modules

These are imported across the engine rather than run per-step (see `SKILL.md` "Shared infrastructure" and `README.md` §3):

- `scripts/report_pdf.py` — the fpdf2 native PDF/SVG renderer (`Report` class, `read_series`, `chart`, `rsi_panel`, `gauge`, `chart_svg`, `render_section_html`). Imported by `mvp_report.py`; charts compute indicators on the full warmed series and crop to `display_days`. Not run directly for `/mvp` (it has its own advisor-side `__main__` payload contract). **See its section in [`mvp-report.md`](./mvp-report.md#relationship-to-report_pdfpy).**
- `scripts/sessions.py` — session profiles + window policy (also `scripts/sessions.py` is imported by `scaffold_payload.py`).
- `scripts/taxonomy.py` — the single prediction vocabulary + validators (`PREDICTION_TYPES`, `confidence_band`, `build_taxonomy`, `asset_class_key`, …). Documented under `../predictions/`.
- `scripts/confidence.py` — deterministic confidence (`compute_confidence`, `compute_dq`). Documented under `../confidence/`. Invoked by `scaffold_payload.py`; the published int is written identically into payload and predictions.

## Output artifacts and where files land

Per run, into the payload's `out_dir` (which the scaffold sets to `reports/<report_date>/<TICKER>`):

```
reports/YYYY-MM-DD/<INSTRUMENT>/
  free.pdf      pro.pdf
  free.html     pro.html
  metadata.json preview.png
```

- **All six files** are uploaded to private R2 by `publish.py` (five upload files + nothing public). Object keys mirror the web `/api/report/<date>/<slug>/<name>` path.
- **Only derived JSON** reaches `web/content/` via `export_content.py`: `catalog.json` and `track-record.json`. Report files themselves are never copied into the web app — they stay private in R2 and are served through the auth-gated `/api/report` route. **See [`generated-artifacts.md`](./generated-artifacts.md).**

Engine working data (`data/candles/`, `data/analysis/`, `data/payloads/`, `data/predictions/`, `data/briefs/`, `data/research/`, `data/social/`, `data/ledger_context/`) stays local/gitignored. The append-only `ledger/outcome_ledger.csv` is the spine that scoring writes and `export_content.py` reads.

## This section's documents

| Doc | Covers |
|---|---|
| [`intraday.md`](./intraday.md) | `intraday.py` — data fetch, indicators, pivots/bands, `--anchor`, providers, freshness/degraded/windows, exit codes |
| [`sessions.md`](./sessions.md) | `sessions.py` — the 4 profiles, window policy, holidays, next-session logic |
| [`scaffold_payload.md`](./scaffold_payload.md) | `scaffold_payload.py` — the compiler/validator: level catalog, setups/ladder/ledger, R:R, predictions P1..P6, every rejection rule, `--check` |
| [`mvp-report.md`](./mvp-report.md) | `mvp_report.py` — the two invocations, the full QA gate, Snapshot vs Pro contents, HTML twins, `preview.png`, `--stamp-visual`; relationship to `report_pdf.py` |
| [`generated-artifacts.md`](./generated-artifacts.md) | The six output files, `metadata.json` contents, the `out_dir` rule, R2 vs `web/content` |
| [`export-content.md`](./export-content.md) | `export_content.py` — the two web JSONs and their shapes, calibration gating, derived analytics |
| [`publish.md`](./publish.md) | `publish.py` — R2 private-bucket model, file set, key layout, env + `.env.local` auto-load, dry-run, security rationale |

## Related tests

- `scripts/test_sessions_intraday.py` — `sessions.py` window logic + `intraday.compute_pivots_bands` golden values (offline, no network).
- `scripts/test_scaffold_payload.py` — QA-by-construction, claim gate, free/pro split, level catalog + RR formatting.
- `scripts/test_firewall.py` — proves marketing metrics never reach research scoring (referenced in `README.md` §9; lives under the confidence/social concern).

## Disclaimer / role limits

AssetFrame is general market research and decision support — **not** investment advice, **not** a personal recommendation, and it **executes no trades** (`mvp/CLAUDE.md`, `README.md` §10). The engine enforces this editorially through the QA gate's banned-language and negated-only checks (see [`mvp-report.md`](./mvp-report.md)). The no-auto-trading rule is a hard rule across the whole project.
