# AssetFrame

**Next-session market intelligence, scored after the fact.**

AssetFrame produces a two-tier research report pair for any tradable instrument — futures, FX, crypto and US single stocks — and publishes them on a live web app where every call is graded against the tape afterwards.

- **AssetFrame Snapshot** — free, one page: status & risk badges, expected range, one chart, the thesis, a Bull/Base/Bear matrix.
- **AssetFrame Pro** — paid, 3–6 pages: verdict box, price ladder, long/short setups with R:R, scenario matrix, event-risk timeline, options/positioning context where sourceable, the trade-quality scorecard, the outcome ledger and a full source audit.

Every Pro report registers falsifiable predictions for the next session. The next run scores the expired ones into an append-only ledger **before doing anything else** — the "scored after the fact" promise is mechanical, not editorial.

---

## Two planes

AssetFrame is a **publishing house, not a live API**: a curated *edition* is generated on a schedule, published once, and every reader downloads the same pre-built files from a zero-egress CDN. User count barely affects cost or speed.

```
GENERATION PLANE  (Python engine, run via /mvp in Claude Code)
  intraday.py ─┐
  news/context ─┼─→ [Claude authors the canonical payload] → mvp_report.py → free/pro PDF+HTML, preview, metadata
  sessions.py ─┘                                                   │
  score_report.py → ledger/outcome_ledger.csv (scores yesterday first)
                                                                   ▼
            publish.py → Cloudflare R2 (files)   ·   sync-db → Neon Postgres (catalog + scored results)

DISTRIBUTION PLANE  (Next.js app in web/, hosted on Vercel)
  Reports browser · member-only track record · gated Pro downloads · account + billing · admin
  Clerk (auth/entitlements) · Lemon Squeezy (merchant-of-record subscriptions) · Vercel Analytics + Speed Insights
```

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Web app | **Next.js 16** (App Router) on **Vercel** | Auto-deploys on push to `main`; root directory = `web/` |
| Report files | **Cloudflare R2** | Zero-egress; free files public, Pro files private behind short-lived signed URLs |
| Catalog + scored results | **Neon Postgres** | Source of truth for the listings and track record (JSON fallback if unset) |
| Auth + entitlements | **Clerk** | Subscription/admin live in `publicMetadata`, set by the Lemon Squeezy webhook |
| Subscriptions | **Lemon Squeezy** | MoR (handles VAT); webhook drives access, API powers in-app cancellation |
| Analytics | **Vercel Analytics + Speed Insights** | Privacy-friendly; surfaced on the admin page |

## How a run works (generation)

1. **Score expired predictions** — any `data/predictions/*_predictions.json` whose window has closed is scored into `ledger/outcome_ledger.csv` (append-only; calibration block appears at ≥10 rows).
2. **Engine** — `scripts/intraday.py` pulls warm-up-extended OHLC and computes indicators (SMA/EMA/RSI/MACD/ATR), swings, VWAP, pivots, ATR bands and level statistics, with explicit `freshness` / `degraded` / `provider` blocks.
3. **Context** — news, catalysts, economic calendar and positioning where genuinely sourceable.
4. **Session rules** — `scripts/sessions.py` applies the instrument profile (`cme_futures`, `fx_spot`, `crypto_24_7`, `us_equity_rth`) and computes the next prediction window.
5. **Canonical payload** — every price lives exactly once in `canonical.levels`; charts, ladder, tables and ledger all reference those ids.
6. **Generate** — `scripts/mvp_report.py` renders both PDFs, both HTML twins, `metadata.json` and `preview.png`, then runs the QA gate. **The build aborts on any violation** (price integrity, research-only language, claim gating, free/Pro split, data honesty).
7. **Publish** — `scripts/publish.py` uploads the locked Pro files to R2; `scripts/export_content.py` + `web/scripts/sync-db.mjs` load the catalog and scored results into Neon.

## The website (distribution)

- **Reports** (`/reports`) — search, asset-class / status / period filters and sort, modern card grid. Snapshots open instantly; Pro is gated.
- **Track record** (`/track-record`) — member-only open calls, scored results and calibration, read from the ledger.
- **Reader** (`/reports/<date>/<slug>`) — Snapshot links for all; Pro downloads stream from R2 via `/api/pro/...` only for entitled users.
- **Account & subscription** (`/account`, `/account/subscription`) — plan status, billing portal and in-app cancellation (Lemon Squeezy API, with portal fallback).
- **Admin** (`/admin`) — member/edition glance and links to the Vercel Analytics & Speed Insights dashboards (admins only).
- **Homepage** — hero, live countdown to the next edition, latest editions and the scored-track-record stats.

Public listing pages use **ISR** (`revalidate`) so they're served from a cached static render and refreshed in the background — fast for readers, light on the database.

## Develop & run

**Engine** (Python 3.10+): `pip install -r requirements.txt`, then drive it from [Claude Code](https://claude.com/claude-code):

```
/mvp WTI
/mvp BTC
/mvp AAPL
```

The deterministic parts also run standalone:

```
python scripts/intraday.py GC=F --name XAUUSD --hrange 10d --roll-utc 22
python scripts/sessions.py cme_futures
python scripts/mvp_report.py data/payloads/XAUUSD_af_payload.json
python scripts/score_report.py data/predictions/XAUUSD_af_predictions.json --dry-run
```

**Web app** (`web/`):

```
cd web
npm install
npm run dev        # http://localhost:3000
npm test           # vitest unit tests (filtering/sorting)
npm run build      # production build
npm run sync-db    # load content/*.json into Neon
```

Secrets live in `web/.env.local` (gitignored) and in Vercel project settings — never in the repo. Required keys: `DATABASE_URL` (Neon), Clerk publishable/secret keys, R2 credentials, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_API_KEY` (for in-app cancel), and the public `NEXT_PUBLIC_*` settings (site URL, checkout URL, price, analytics URL). See **GO-LIVE.md** for the full runbook.

## Deploy

Push to GitHub → Vercel rebuilds and ships automatically (Root Directory `web`, Framework Preset Next.js, Deployment Protection off). Custom domain: `assetframe.co.uk`.

## Repository layout

```
web/                         Next.js app (the live product)
  app/                       routes: /, /reports, /track-record, /account, /admin, /api/*
  components/                UI (shadcn/ui in components/ui) + ReportsBrowser, Countdown, …
  lib/                       content (DB), entitlements, search, db, lemonsqueezy
  db/schema.sql              Neon schema (editions, open_calls, scored_results)
  scripts/sync-db.mjs        loads content JSON into Neon
scripts/                     Python engine (intraday, sessions, mvp_report, report_pdf,
                             score_report, export_content, publish)
data/                        candles / analysis / payloads / predictions (per run)
ledger/outcome_ledger.csv    the scored track record (append-only)
reports/YYYY-MM-DD/<INSTR>/  generated report pairs
logo/                        brand assets + favicon pack
GO-LIVE.md                   end-to-end launch & publishing runbook
```

## Role & limits

AssetFrame publishes **general market research and decision support**. It is **not** investment advice, **not** a personal recommendation, and it **executes no trades** — there is no order-placement path. No outcome is guaranteed; markets are uncertain and capital is at risk. Do your own research and consider an FCA-authorised adviser.
