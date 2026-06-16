# Directory map

> Part of the AssetFrame `/documentation` vault → `architecture/`.
> See also: [system-overview.md](./system-overview.md) ·
> [generation-pipeline.md](./generation-pipeline.md) ·
> [distribution-pipeline.md](./distribution-pipeline.md) ·
> [data-flow.md](./data-flow.md) · [trust-boundaries.md](./trust-boundaries.md)

An annotated map of `mvp/`, grounded in `README.md` §4 (repo layout), `mvp/CLAUDE.md`
conventions, `mvp/.gitignore`, and what each script actually reads/writes. "gitignored"
means the path matches a rule in `mvp/.gitignore` and is regenerated each run.

```
mvp/
├── README.md            human-facing overview (the only human doc at root)
├── CLAUDE.md            AI project rules for the engine (KEEP)
├── requirements.txt     Python deps: fpdf2>=2.8, pymupdf>=1.26 (boto3 optional, for publish.py)
├── .gitignore           the source of truth for what is tracked vs working state
├── documentation/       this vault (architecture/ + others)
├── scripts/             the Python engine + tests (see below)
├── data/                all working market data + AI artifacts (gitignored; see below)
├── ledger/              the scored track record + derived products (see below)
├── reports/             generated report pairs (gitignored)
├── logo/                brand assets + favicon source
└── web/                 the Next.js 16 app — the live product (see below)
```

---

## `scripts/` — the Python engine

Stdlib-only except `report_pdf.py`/`mvp_report.py` (`fpdf2`) and `publish.py` (`boto3`,
optional). Every non-test script resolves its own paths, so `cwd` is `mvp/` by convention.

| Script | Reads | Writes |
|---|---|---|
| `intraday.py` | Yahoo / EODHD chart API | `data/candles/<NAME>_{hourly,daily}.csv`, `data/analysis/<NAME>_analysis.json` |
| `sessions.py` | (library) — session profiles, called by the scaffold | — |
| `taxonomy.py` | (library) — the one prediction vocabulary + validators | — |
| `research_pack.py` | an AI draft via `--in` (no web calls) | `data/research/<NAME>_research_pack.json` |
| `social_pack.py` | an AI draft via `--in` (optional, no web calls) | `data/social/<NAME>_social_pack.json` |
| `ledger_context.py` | `ledger/outcome_ledger.csv` | `data/ledger_context/<NAME>_ledger_context.json` |
| `research_memory.py` | `ledger/outcome_ledger.csv` | `ledger/research_memory.json` |
| `confidence.py` | (library) the analysis/brief/packs/ledger-context/calib — invoked by the scaffold | — (returns the breakdown dict) |
| `calibrate.py` | `ledger/outcome_ledger.csv` | `ledger/calibration_map.json` |
| `scaffold_payload.py` | analysis JSON, the brief, research/social packs, ledger context, calib, the hourly CSV | `data/payloads/<NAME>_af_payload.json`, `data/predictions/<NAME>_predictions.json` |
| `report_pdf.py` | candle CSVs (library: charts + fpdf2 PDF primitives) | (renders into PDFs via `mvp_report.py`) |
| `mvp_report.py` | `data/payloads/<NAME>_af_payload.json` + the candle CSVs it references | `reports/<date>/<slug>/{free,pro}.{pdf,html}`, `metadata.json`, `preview.png` |
| `score_report.py` | `data/predictions/<NAME>_predictions.json`, the hourly CSV, the ledger | appends to `ledger/outcome_ledger.csv` |
| `social_posts.py` | `data/payloads/<NAME>_af_payload.json` (+ brief) | `data/social_posts/<NAME>_<DATE>_posts.json` (no auto-posting) |
| `export_content.py` | `reports/*/*/metadata.json`, `ledger/outcome_ledger.csv`, `data/predictions/*` | `web/content/catalog.json`, `web/content/track-record.json` |
| `publish.py` | `reports/*/*/{free,pro}.{html,pdf}` + `preview.png`; R2 creds | objects in private R2 (`<date>/<slug>/…`) |
| `build_site.py` | `reports/` + `ledger/` | a self-contained static `site/` folder (an **alternative** delivery target; see note below) |

### Tests (`scripts/test_*.py`)

Nine offline test suites (stdlib `unittest`; no network). Run each as `python
scripts/test_<name>.py` from `mvp/`:

| Test | Covers |
|---|---|
| `test_firewall.py` | the research–scoring firewall (marketing metrics never reach scoring; the recorder never imports scoring) — prints `FIREWALL OK` |
| `test_confidence.py` | blend weights, every hard cap, social subtract-only, calibration apply, `compute_dq`, determinism, division guards |
| `test_calibrate.py` | PAVA monotonicity, shrinkage-to-identity, empty/young-ledger identity |
| `test_score_report.py` | each scoring mechanic, the setup grader, the calibration summary, the manual validator, the append-only write |
| `test_ledger_context.py` | the no-look-ahead filter, empty-ledger degradation, taxonomy-scoped breakdowns (covers `research_memory.py` too) |
| `test_scaffold_payload.py` | QA-by-construction, the `THESIS_BLOCKED` claim gate, the free/pro split guard, level-catalog / R:R helpers |
| `test_sessions_intraday.py` | session window logic + the pure `compute_pivots_bands` anchor math (golden values) |
| `test_taxonomy.py` | validators reject typos; band/bucket boundaries are exact |
| `test_social_posts.py` | the safe-wording QA gate, the negated-"guaranteed" allowance, neutral framing |

> See [trust-boundaries.md](./trust-boundaries.md) for which boundary each test guards.

> **Two delivery targets exist.** `web/` (Next.js 16 on Vercel) is the live product;
> `scripts/build_site.py` produces a separate stdlib-only static `site/` folder for Cloudflare
> Pages. Both gate Pro the same way (free public/in-account, Pro private in R2). The `site/`
> output is gitignored (`mvp/.gitignore` `site/`). This vault documents the `web/` path as the
> primary product; `build_site.py` is the lightweight static alternative.

---

## `data/` — working market data + AI artifacts (all gitignored)

The whole tree is per-run working state. `mvp/.gitignore` ignores each subdirectory's
contents (some keep a `.gitkeep`). Nothing here reaches git/Neon.

| Directory | Holds | Written by | Read by |
|---|---|---|---|
| `data/candles/` | hourly + daily OHLC CSVs (`<NAME>_{hourly,daily}.csv`) | `intraday.py` | `scaffold_payload.py`, `mvp_report.py`, `score_report.py`, `report_pdf.py` |
| `data/analysis/` | engine analysis JSON (indicators, pivots, bands, freshness, windows) | `intraday.py` | `scaffold_payload.py`, `confidence.py` |
| `data/research/` | sourced research packs | `research_pack.py` | `scaffold_payload.py`, `confidence.py` |
| `data/social/` | optional social packs (subtract-only signal) | `social_pack.py` | `scaffold_payload.py`, `confidence.py` |
| `data/ledger_context/` | per-instrument ledger context (no look-ahead) | `ledger_context.py` | the AI (before the brief), `confidence.py` |
| `data/briefs/` | **the one hand-authored artifact** — the research brief (prose + intent + sourced claims, never prices) | the AI (analyst) | `scaffold_payload.py`, `social_posts.py` |
| `data/payloads/` | compiled canonical report payloads | `scaffold_payload.py` | `mvp_report.py`, `social_posts.py` |
| `data/predictions/` | registered predictions awaiting scoring (P1..P6 + taxonomy) | `scaffold_payload.py` | `score_report.py`, `export_content.py` |
| `data/social_posts/` | distribution drafts (4 channels, `auto_post:false`) | `social_posts.py` | a human / future gated integration |

`data/briefs/AAPL_research_brief.json` is the shipped worked example of the brief schema
(`README.md` §4).

> `.gitignore` detail: `data/candles/*`, `data/analysis/*`, `data/payloads/*`,
> `data/predictions/*` keep a `.gitkeep`; `data/briefs/*`, `data/research/*`, `data/social/*`,
> `data/ledger_context/*`, `data/social_posts/*` are ignored wholesale (lines for each in
> `mvp/.gitignore`).

---

## `ledger/` — the scored track record + derived products

| File | Holds | Tracked? | Written by |
|---|---|---|---|
| `ledger/outcome_ledger.csv` | the append-only scored record (20 columns) | **tracked** (source of truth) | `score_report.py` (created on first append) |
| `ledger/calibration_map.json` | the isotonic confidence map | gitignored (derived) | `calibrate.py` |
| `ledger/research_memory.json` | cross-instrument reasoning patterns | gitignored (derived) | `research_memory.py` |
| `ledger/.gitkeep` | keeps the dir in git | tracked | — |

**Current state (day-one).** `outcome_ledger.csv` **does not exist yet** — only `.gitkeep`,
`calibration_map.json` (an identity map, `n_rows: 0`), and `research_memory.json` are present.
`score_report.py` creates the CSV and writes its header on the first scored window (lines
268-275). The derived `calibration_map.json` / `research_memory.json` are gitignored because
they are rebuilt from the CSV; the CSV itself stays tracked (`mvp/.gitignore` "Derived ledger
products" block). See
[system-overview.md](./system-overview.md#current-state-day-one--empty-ledger).

---

## `reports/` — generated report pairs (gitignored)

```
reports/
├── .gitkeep
└── <YYYY-MM-DD>/<INSTRUMENT>/      e.g. reports/2026-06-16/AAPL/
    ├── free.html        free Snapshot (HTML)
    ├── free.pdf         free Snapshot (PDF)
    ├── pro.html         Pro report (HTML)
    ├── pro.pdf          Pro report (PDF)
    ├── metadata.json    edition metadata (drives catalog.json)
    └── preview.png      social/preview image
```

Written by `mvp_report.py`; the `out_dir` MUST be exactly `reports/<date>/<slug>`
(`scaffold` computes `reports/{report_date}/{ticker}`, line 358). `export_content.py` and
`publish.py` both glob `*/*/metadata.json` and derive `date, slug` from the two-level path, so
the structure is load-bearing (the "nesting bug" guard — see
[distribution-pipeline.md](./distribution-pipeline.md#the-out_dir-nesting-rule-do-not-regress)).
Date directories beginning with `_` are treated as drafts and skipped by both
(`export_content.py` line 89, `publish.py` line 62). The whole tree is gitignored
(`reports/*` with a `.gitkeep`). Report files reach **R2 only**, never git/Neon.

---

## `logo/` — brand assets

```
logo/
├── logo.png               full logo
├── logo_trimmed.png       trimmed wordmark — used on every PDF header, HTML, preview
└── logo_trimmed_white.png white variant
```

`mvp_report.py` references `logo/logo_trimmed.png` (`LOGO` line 46) and the QA gate **aborts
the build if it is missing** (lines 952-953). `SKILL.md` also describes a favicon pack under
`logo/`; only the three PNGs above are present in the repo — `NOT VERIFIED` whether the
favicon pack lives here or under `web/public/` (confirm against `web/public/`).

---

## `web/` — the Next.js 16 app (the live product)

Root directory for Vercel is `web/` (`README.md` §8). Pre-release Next.js — read
`node_modules/next/dist/docs/` before editing (`web/AGENTS.md`, `web/CLAUDE.md`).

| Path | Holds |
|---|---|
| `web/AGENTS.md`, `web/CLAUDE.md` | AI instructions for the web code (KEEP) |
| `web/app/` | App Router routes: `/`, `/reports`, `/track-record`, `/reviews`, `/feedback`, `/developers`, `/account`, `/admin`, the legal/marketing pages, and `/api/*` (incl. `/api/report`, `/api/mcp`, `/api/v1`, `/api/webhooks`, `/api/cron`) |
| `web/components/` | UI — `Header.tsx`, `ReportsBrowser`, `Countdown`, `TrackRecordAnalytics`, `PushToggle`, `admin/*`, `Motion.tsx` (GSAP); shadcn/ui under `components/ui/` |
| `web/lib/` | content (DB), `access.ts` / `entitlements.ts`, `search.ts` / `taxonomy.ts`, `db.ts`, `lemonsqueezy.ts`, `r2.ts`, `report-key.ts`, `push.ts` / `email.ts`, `google-reviews.ts`, `cron.ts`, **`engagement.ts`** (the marketing recorder firewalled from scoring), `publish.ts` |
| `web/migrations/` | versioned DB migrations (node-pg-migrate; the authoritative schema) |
| `web/scripts/sync-db.mjs` | loads `web/content/*.json` into Neon (both branches) |
| `web/content/` | `catalog.json` + `track-record.json` — the **only** engine output that reaches git/Neon |
| `web/public/` | static assets served by Next.js |
| `web/db/`, `web/tests/` | DB helpers; the Vitest suite (filtering/sorting + a11y axe + security) |
| `web/next.config.ts`, `site.config.ts`, `vercel.json` | security headers, per-env absolute URLs, the daily cron schedule |
| `web/.env.local` | real secrets (gitignored); also auto-loaded by `publish.py` and `sync-db.mjs` |
| `web/node_modules/`, `web/.next/`, `web/out/` | build artifacts (gitignored) |

**The firewall touchpoint:** `web/lib/engagement.ts` is the marketing recorder that
`scripts/test_firewall.py` asserts must never import the scoring path
([trust-boundaries.md](./trust-boundaries.md#1-the-researchscoring-firewall)). It sits beside
the scoring-adjacent `taxonomy.ts` / `content.ts` in `web/lib/`, which is exactly why the test
checks its imports rather than its mere co-location.

---

## What reaches git/Neon vs stays local (the one-line rule)

- **Tracked / reaches git/Neon:** `web/content/catalog.json`, `web/content/track-record.json`,
  and `ledger/outcome_ledger.csv` (when it exists). Plus all source: `scripts/`, `web/` code,
  docs, `logo/`.
- **Local working state (gitignored):** everything under `data/`, everything under
  `reports/`, the derived `ledger/calibration_map.json` + `ledger/research_memory.json`, the
  static `site/`, and all `.env*` secrets.
- **Reaches R2 only (never git/Neon):** the report files (`free`/`pro` `.pdf`/`.html` +
  `preview.png`), uploaded by `publish.py` and served through the gated `/api/report` route.
