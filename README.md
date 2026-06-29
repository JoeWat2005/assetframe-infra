# AssetFrame

**Next-session market intelligence, scored after the fact.**

AssetFrame produces a two-tier research report pair for any tradable instrument — futures, FX, crypto, single stocks, ETFs, indices, metals/energy, rates — and publishes them on a live web app where every call is graded against the tape afterwards.

- **AssetFrame Snapshot** — free, one page: status & risk badges, expected range, one chart, the thesis, a Bull/Base/Bear matrix.
- **AssetFrame Pro** — paid, 3–6 pages: verdict box, price ladder, long/short setups with R:R, scenario matrix, event-risk timeline, options/positioning context where sourceable, the trade-quality scorecard, the outcome ledger and a full source audit.

Every Pro report registers falsifiable predictions for the next session. The next run **scores the expired ones into an append-only ledger before doing anything else** — the "scored after the fact" promise is mechanical, not editorial.

This is **general market research and decision support — not investment advice, not a personal recommendation, and it places no trades.** See [Role, limits & disclaimer](#role-limits--disclaimer).

> **Full engineering + product reference:** the [`documentation/` vault](documentation/README.md) (28 sections, ~120 files). This README is the concise human entry point; the vault is the depth. The operating manual for generating a report is [`.claude/skills/mvp/SKILL.md`](.claude/skills/mvp/SKILL.md). AI-instruction files (not human docs) live at `mvp/CLAUDE.md`, `mvp/web/CLAUDE.md`, and `mvp/web/AGENTS.md` — read those before driving the engine or touching the web code.
>
> **Launch-readiness: GREEN (for MVP)** — see [`documentation/changelog/launch-audit.md`](documentation/changelog/launch-audit.md).

---

## Contents

1. [What it is](#what-it-is)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Quick start](#quick-start)
4. [Full documentation](#full-documentation)
5. [Role, limits & disclaimer](#role-limits--disclaimer)

---

## What it is

AssetFrame is a **publishing house, not a live API**. A curated *edition* for an instrument is generated on a schedule, reviewed by a human, published once, and then every reader downloads the same pre-built files from a zero-egress CDN. User count barely affects cost or speed.

The product is built on one promise: **accountability**. Each Pro edition makes falsifiable, machine-checkable predictions about the *next* session. Those predictions are registered the moment they're published, and they're scored against the actual tape after their window closes — into an append-only ledger that nobody can quietly rewrite. The public track record, the calibration curve, and the per-report confidence number all flow from that ledger.

The guiding principle of the engine (V2):

> **AI = analyst / strategist / research desk. Python = compiler / validator. Ledger = memory + calibration + proof. Confidence = deterministic + auditable. Social = optional, subtract-only. Human = final reviewer. Website = trust / delivery.**
>
> *Automate away fragile manual JSON, not the analyst.*

The AI authors exactly **one** artifact per report — a research brief of prose, prediction *intent*, and sourced claims, **never prices**. Everything numerical and structural (levels, pivots, bands, R:R, ladder, predictions, the confidence score, every QA check) is compiled and validated by Python. A human reviews every edition before it ships.

> **Day-one state:** the track record currently shows **0 scored results** (predictions are registered; the first results land as the earliest windows close) and `/reviews` is **"coming soon"** (no Google Business Profile connected yet). Docs describe the *mechanism*, never a populated record. → [product/methodology.md](documentation/product/methodology.md), [product/product-overview.md](documentation/product/product-overview.md).

---

## Architecture at a glance

AssetFrame has **two planes**:

- **Generation plane** — a Python engine, driven by an agentic research team in [Claude Code](https://claude.com/claude-code) via the `/mvp` skill. It pulls market data, researches catalysts, lets the analyst author one brief, compiles the canonical report payload + predictions, computes a deterministic confidence score, renders the PDFs/HTML through a QA gate, and stops for human review.
- **Distribution plane** — a Next.js 16 app in `web/`, hosted on Vercel. It serves the reports browser, the Pro-gated track record, gated Pro downloads, accounts + billing, the MCP server + REST API, notifications, and an admin console.

```
GENERATION PLANE  (Python engine + agentic /mvp team; human-reviewed; mostly gitignored)

  score_report.py (scores expired windows FIRST) ─► ledger/outcome_ledger.csv ─► calibrate.py
  intraday.py [--anchor] · research_pack.py · social_pack.py (OPT) ─► ledger_context.py
        └─► AI writes data/briefs/<NAME>_research_brief.json   (the ONLY hand-authored artifact)
        └─► scaffold_payload.py (payload + predictions; invokes confidence.py)
        └─► mvp_report.py (Snapshot + Pro + metadata + preview; QA gate aborts on error)
        └─► ★ HUMAN REVIEW ★  ─►  export_content.py → web/content/*.json · publish.py → R2 · sync-db → Neon

DISTRIBUTION PLANE  (Next.js 16 app in web/, on Vercel)

  Reports browser · Pro-gated track record + analytics · gated Pro downloads · account + billing
  MCP server (/api/mcp) · REST API (/api/v1) · web-push + email notifications · admin console
  Clerk + Clerk Billing (auth/entitlements/subscriptions) · Neon Postgres · R2 · Vercel Analytics
```

Engine artifacts under `data/` stay local/gitignored; only `web/content/*.json` and the ledger reach git/Neon. Full detail, the role-split table, and the 12-step pipeline are in the documentation vault → [architecture/system-overview.md](documentation/architecture/system-overview.md), [architecture/generation-pipeline.md](documentation/architecture/generation-pipeline.md), [architecture/distribution-pipeline.md](documentation/architecture/distribution-pipeline.md).

### Stack (web)

Next.js 16 (App Router) on Vercel (root `web/`) · **Clerk** auth/entitlements + **Clerk Billing** subscriptions (Stripe under the hood) · **Neon Postgres** (JSON fallback) · **Cloudflare R2** report files (Pro behind 120s signed URLs) · Tailwind v4 + shadcn/ui + GSAP · **web-push** (VAPID) + **Resend** email · Vercel Analytics + Speed Insights · `node-pg-migrate`. → [website/](documentation/website/routes.md), [auth/](documentation/auth/overview.md), [billing/](documentation/billing/overview.md), [database/](documentation/database/schema.md), [storage/](documentation/storage/overview.md), [deployment/](documentation/deployment/overview.md).

---

## Quick start

### Generate a report (the engine)

Python 3.10+: `pip install -r requirements.txt`, then from [Claude Code](https://claude.com/claude-code):

```
/mvp WTI
/mvp BTC
/mvp AAPL
```

The pipeline runs in order — **scoring first, human review last**. The deterministic parts also run standalone (always confirm flags with `--help`):

```
python scripts/intraday.py GC=F --name XAUUSD --hrange 10d --anchor prior-completed --roll-utc 22
python scripts/score_report.py data/predictions/XAUUSD_predictions.json --dry-run
python scripts/scaffold_payload.py XAUUSD --session-profile cme_futures --check
python scripts/mvp_report.py data/payloads/XAUUSD_af_payload.json
```

Output per run: `reports/YYYY-MM-DD/<INSTRUMENT>/` → `free.pdf`, `pro.pdf`, `free.html`, `pro.html`, `metadata.json`, `preview.png`. Full step-by-step: `.claude/skills/mvp/SKILL.md` and [report-engine/overview.md](documentation/report-engine/overview.md).

### Run the web app

```
cd web
cp .env.example .env.local   # paste your keys (Clerk alone is enough to see auth working)
npm install
npm run dev                  # http://localhost:3000
npm test                     # vitest (filtering/sorting + a11y axe smoke + security)
npm run build                # production build
npm run db:setup             # migrate, then sync — the usual publish step
```

Public pages work with no keys; sign-in, Track record, Pro and Admin need the env keys. → [deployment/environment-variables.md](documentation/deployment/environment-variables.md).

### Publish an edition

```
/mvp ETH   /mvp SOL   ...                  # generate (scores yesterday first); HUMAN REVIEW before continuing
python scripts/export_content.py           # refresh catalog + track record + free assets into web/
python scripts/publish.py                  # push free + Pro files to R2
(cd web && npm run sync-db)                # load into Neon (both branches)
git add -A && git commit -m "edition: <date>" && git push   # Vercel auto-redeploys
```

`out_dir` MUST be `reports/<date>/<slug>`. → [operations/publication-workflow.md](documentation/operations/publication-workflow.md), [report-engine/publish.md](documentation/report-engine/publish.md).

---

## Full documentation

The [`documentation/` vault](documentation/README.md) is the complete reference. Start with its [index](documentation/README.md), or jump straight to a section:

- **Product** — [product overview](documentation/product/product-overview.md) · [free vs Pro](documentation/product/free-vs-pro.md) · [methodology](documentation/product/methodology.md) · [report types](documentation/product/report-types.md) · [disclaimers](documentation/product/disclaimers.md)
- **Architecture** — [system overview](documentation/architecture/system-overview.md) · [generation pipeline](documentation/architecture/generation-pipeline.md) · [distribution pipeline](documentation/architecture/distribution-pipeline.md) · [data flow](documentation/architecture/data-flow.md) · [trust boundaries](documentation/architecture/trust-boundaries.md)
- **Engine** — [report-engine](documentation/report-engine/overview.md) · [predictions](documentation/predictions/overview.md) · [confidence](documentation/confidence/overview.md) · [ledger](documentation/ledger/overview.md) · [research](documentation/research/overview.md) · [social](documentation/social/overview.md)
- **Web & platform** — [website](documentation/website/routes.md) · [frontend](documentation/frontend/components.md) · [backend](documentation/backend/backend-overview.md) · [api](documentation/api/overview.md) · [mcp](documentation/mcp/overview.md) · [auth](documentation/auth/overview.md) · [billing](documentation/billing/overview.md) · [database](documentation/database/schema.md) · [storage](documentation/storage/overview.md) · [security](documentation/security/threat-model.md)
- **Ship & run** — [deployment](documentation/deployment/overview.md) · [operations](documentation/operations/daily-operations.md) · [admin](documentation/admin/admin-panel.md) · [testing](documentation/testing/strategy.md) · [analytics](documentation/analytics/overview.md) · [accessibility](documentation/accessibility/overview.md) · [seo](documentation/seo/overview.md) · [troubleshooting](documentation/troubleshooting/README.md) · [changelog / launch audit](documentation/changelog/launch-audit.md)

### Repository layout

```
mvp/
  README.md                  this file (the concise human entry point)
  CLAUDE.md                  AI project rules for the engine (KEEP)
  documentation/             the full engineering + product vault (start at documentation/README.md)
  scripts/                   Python engine
  data/                      candles / analysis / research / social / briefs / payloads / predictions (gitignored)
  ledger/                    outcome_ledger.csv (append-only) + calibration_map.json + research_memory.json
  reports/YYYY-MM-DD/<INSTR>/  generated report pairs (gitignored)
  logo/                      brand assets + favicon pack
  web/                       Next.js app (the live product)
    AGENTS.md, CLAUDE.md     AI instructions for web code (KEEP)
    app/ components/ lib/ migrations/ scripts/sync-db.mjs
```

---

## Role, limits & disclaimer

AssetFrame publishes **general market research and decision support**. It is **not** investment advice, **not** a personal recommendation, and it **executes no trades** — there is no order-placement path anywhere in the system.

**No-auto-trading (hard rule):** the system never places, modifies, or cancels any order on any brokerage, regardless of what a report concludes. If asked to execute, it refuses and explains it is decision-support only.

No outcome is guaranteed; markets are uncertain and capital is at risk. Do your own research and consider an FCA-authorised adviser. Before charging real money, the disclaimer should be reviewed by a solicitor familiar with FCA financial promotions, and reports for paying customers should be generated on compliant/licensed data feeds (the engine has the provider switch: `ADVISOR_DATA_PROVIDER` / `EODHD_API_KEY` in `scripts/intraday.py`; futures `=F` always stay on Yahoo).

**Disclaimer wording (carried on every report and page):** *"AssetFrame publishes general market research and decision support. It is not investment advice, not a personal recommendation, and executes no trades. No outcome is guaranteed; markets are uncertain and your capital is at risk. Do your own research and consider an FCA-authorised adviser."*

**Copyright.** The reports, site, brand and code are © AssetFrame. Pro and Snapshot reports are licensed for the subscriber's personal, non-commercial use — redistribution, resale or public sharing is prohibited (Terms §8–9). Report files are served only through the auth-gated `/api/report` route as short-lived signed URLs, never as public objects.

Full compliance posture, the verbatim language rules, and the regulatory caveat → [product/disclaimers.md](documentation/product/disclaimers.md).
