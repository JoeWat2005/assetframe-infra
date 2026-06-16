# AssetFrame

**Next-session market intelligence, scored after the fact.**

AssetFrame produces a two-tier research report pair for any tradable instrument — futures, FX, crypto, single stocks, ETFs, indices, metals/energy, rates — and publishes them on a live web app where every call is graded against the tape afterwards.

- **AssetFrame Snapshot** — free, one page: status & risk badges, expected range, one chart, the thesis, a Bull/Base/Bear matrix.
- **AssetFrame Pro** — paid, 3–6 pages: verdict box, price ladder, long/short setups with R:R, scenario matrix, event-risk timeline, options/positioning context where sourceable, the trade-quality scorecard, the outcome ledger and a full source audit.

Every Pro report registers falsifiable predictions for the next session. The next run **scores the expired ones into an append-only ledger before doing anything else** — the "scored after the fact" promise is mechanical, not editorial.

This is **general market research and decision support — not investment advice, not a personal recommendation, and it places no trades.** See [Role, limits & disclaimer](#10-role-limits--disclaimer).

> This README is the human-facing overview. The operating manual for generating a report is `.claude/skills/mvp/SKILL.md`. AI-instruction files (not human docs) live at `mvp/CLAUDE.md`, `mvp/web/CLAUDE.md`, and `mvp/web/AGENTS.md` — read those before driving the engine or touching the web code.

---

## Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Report pipeline (Engine V2)](#3-report-pipeline-engine-v2)
4. [Web app](#4-web-app)
5. [MCP & API](#5-mcp--api)
6. [Notifications](#6-notifications)
7. [Track record & ledger](#7-track-record--ledger)
8. [Deployment](#8-deployment)
9. [QA & Accessibility](#9-qa--accessibility)
10. [Role, limits & disclaimer](#10-role-limits--disclaimer)

---

## 1. Overview

AssetFrame is a **publishing house, not a live API**. A curated *edition* for an instrument is generated on a schedule, reviewed by a human, published once, and then every reader downloads the same pre-built files from a zero-egress CDN. User count barely affects cost or speed.

The product is built on one promise: **accountability**. Each Pro edition makes falsifiable, machine-checkable predictions about the *next* session. Those predictions are registered the moment they're published, and they're scored against the actual tape after their window closes — into an append-only ledger that nobody can quietly rewrite. The public track record, the calibration curve, and the per-report confidence number all flow from that ledger.

The guiding principle of the engine (V2):

> **AI = analyst / strategist / research desk. Python = compiler / validator. Ledger = memory + calibration + proof. Confidence = deterministic + auditable. Social = optional, subtract-only. Human = final reviewer. Website = trust / delivery.**
>
> *Automate away fragile manual JSON, not the analyst.*

The AI authors exactly **one** artifact per report — a research brief of prose, prediction *intent*, and sourced claims, **never prices**. Everything numerical and structural (levels, pivots, bands, R:R, ladder, predictions, the confidence score, every QA check) is compiled and validated by Python. A human reviews every edition before it ships.

---

## 2. Architecture

AssetFrame has **two planes**:

- **Generation plane** — a Python engine, driven by an agentic research team in [Claude Code](https://claude.com/claude-code) via the `/mvp` skill. It pulls market data, researches catalysts, lets the analyst author one brief, compiles the canonical report payload + predictions, computes a deterministic confidence score, renders the PDFs/HTML through a QA gate, and stops for human review.
- **Distribution plane** — a Next.js 16 app in `web/`, hosted on Vercel. It serves the reports browser, the Pro-gated track record, gated Pro downloads, accounts + billing, the MCP server + REST API, notifications, and an admin console.

### The role split

| Actor | Responsibility |
|---|---|
| **AI** | Analyst + strategist + research desk. Authors one brief: directional view, thesis, prediction *intent* (type + expected move in words), scenarios, risks, conviction reasoning, and sourced claims. **Never types a price.** |
| **Python** | Compiler + validator + quant engine. Builds every level, pivot, band, R:R, ladder, prediction, window, and integrity check. Rejects unsupported numbers and claims. |
| **Ledger** | Memory + calibration + proof. Feeds history *into* the brief (no look-ahead) and records the scored-after-the-fact outcomes. |
| **Confidence engine** | Deterministic, auditable score. The AI *explains* it; it never *sets* it. |
| **Social** | Optional, subtract-only. May only *reduce* confidence, never raise it; never a factual source. |
| **Human** | Final reviewer. No edition publishes without a visual + editorial sign-off. |
| **Website** | Trust + delivery. Publishes editions, surfaces the track record, gates Pro. |

### Pipeline diagram

```
GENERATION PLANE  (Python engine + agentic research team via /mvp; human-reviewed)

  score_report.py  ── scores expired windows FIRST (no look-ahead) ──► ledger/outcome_ledger.csv
        │                                                                      │
        └─► calibrate.py ──► ledger/calibration_map.json                       │
                                                                               │
  intraday.py [--anchor live|prior-completed|friday]  ─┐                       │
  research_pack.py  (sourced factual context)          │                       │
  social_pack.py    (OPTIONAL, subtract-only)          ├─► ledger_context.py ──┘
                                                        │        │
                                                        ▼        ▼
                       AI writes data/briefs/<NAME>_research_brief.json
                       (the ONLY hand-authored artifact — prose + intent + sourced claims, never prices)
                                                        │
                                                        ▼
  scaffold_payload.py  ── compiles canonical payload + predictions; invokes confidence.py;
                          rejects unsupported numbers/claims ──► data/payloads/, data/predictions/
                                                        │
                                                        ▼
  mvp_report.py  ── renders Snapshot + Pro (PDF + HTML + metadata.json + preview.png) + QA gate (aborts on error)
                                                        │
                                                        ▼
                              ★ HUMAN REVIEW ★  (mvp_report.py <out_dir> --stamp-visual)
                                                        │
                                                        ▼
  export_content.py ──► web/content/*.json     publish.py ──► Cloudflare R2 (files)     web/scripts/sync-db.mjs ──► Neon

DISTRIBUTION PLANE  (Next.js 16 app in web/, on Vercel)

  Reports browser · Pro-gated track record + analytics · gated Pro downloads · account + billing
  MCP server (/api/mcp) · REST API (/api/v1) · web-push + email notifications · admin console
  Clerk (auth/entitlements) · Lemon Squeezy (MoR subscriptions) · Neon Postgres · R2 · Vercel Analytics
```

Engine artifacts under `data/` (`analysis/`, `research/`, `social/`, `ledger_context/`, `briefs/`, `payloads/`, `predictions/`) stay local/gitignored. Only `web/content/*.json` and the ledger reach git/Neon.

---

## 3. Report pipeline (Engine V2)

`.claude/skills/mvp/SKILL.md` is the authoritative operating manual; this is the map. The per-instrument flow runs **in order** — scoring first, human review last.

| # | Step | Script(s) | What it does |
|---|---|---|---|
| 1 | **Score expired windows first** | `score_report.py` → `calibrate.py` | Any `data/predictions/*_predictions.json` whose `window_end_utc` has passed with no ledger row is scored into `ledger/outcome_ledger.csv` (append-only; verdicts Y/N/NT/MANUAL; hit-rate = Y/(Y+N)). Then `calibrate.py` refits the isotonic calibration map. Doing this *first* is what keeps history provably free of look-ahead. |
| 2 | **Run the engine** | `intraday.py [--anchor …]` | Pulls warm-up-extended OHLC and computes SMA/EMA/RSI/MACD/ATR, swings, VWAP, pivots, ATR day-bands, level stats, plus explicit `freshness`/`degraded`/`provider`/`windows` blocks. `--anchor live\|prior-completed\|friday` re-derives pivots/bands on a chosen completed session (replaces the old hand-built `*_anchored.json`). |
| 3 | **Research pack** | `research_pack.py` | Gathers and **sources** factual context (macro/asset news, earnings/events, economic calendar with UK times, regulatory/geopolitical), each item with a source URL, timestamp, quality note, and a `source_gaps[]` list. The brief's claims are checked against this. |
| 4 | **Social pack (OPTIONAL)** | `social_pack.py` | Summarises the *market conversation* — sentiment, crowding, hype/manipulation warnings. Pipeline runs normally if skipped. **Subtract-only** input to confidence; never a factual source. |
| 5 | **Ledger context** | `ledger_context.py` | Writes per-instrument / asset-class / prediction-type hit rates, streaks, similar-setup history, and `notes_for_ai[]`. **Hard no-look-ahead:** aggregates only rows whose window closed strictly before `--as-of`. (Future: `research_memory.py` adds reasoning-level learning under the same rule.) |
| 6 | **Write the research brief** | *(AI — the only hand-authored artifact)* | `data/briefs/<NAME>_research_brief.json`: prose + prediction *intent* + sourced claims. **No prices, levels, R:R, ladders, or confidence numbers.** Example: `data/briefs/AAPL_research_brief.json`. |
| 7 | **Compile payload + predictions** | `scaffold_payload.py` | The compiler/validator. Builds canonical levels (one price, lives once), long/short setups, R:R, ladder, `ledger_levels`, and the predictions file (P1..P6 + taxonomy block) from one source — so payload and predictions can't diverge. Reads `last_price` from the CSV so the price triple-equality holds by construction. **Rejects** off-catalog prices and unsupported/unverified thesis claims. Use `--check` first. |
| 8 | **Confidence engine** | `confidence.py` *(invoked by the scaffold)* | `raw = 50·market + 30·ledger + 20·catalyst + social_adj` → `capped` (hard caps) → `published = calibrate(capped)`. Carries `components[]`, `caps_applied[]`, `raw`/`capped`/`published`/`band`, `conf_version`. The AI **explains** the number, never sets it. |
| 9 | **Prediction taxonomy** | `taxonomy.py` | Tags the primary prediction: `prediction_type ∈ breakout \| rejection \| continuation \| mean_reversion \| range_hold \| volatility_expansion`, plus `direction`, `horizon`, `asset_class`, `market_regime`. This threads **predictions → ledger → track record → confidence → calibration → research memory**, enabling insights like "breakouts in high-vol crypto hit 71%." |
| 10 | **Generate + QA gate** | `mvp_report.py` (+ `report_pdf.py`, `sessions.py`) | Renders Snapshot + Pro PDFs/HTML + `metadata.json` + `preview.png` and runs the QA gate. **Build aborts on any violation** (price integrity, levels↔setups↔ladder↔ledger identity, R:R lint, banned-language scan, free/pro split, claim-trace, taxonomy, lookahead, session fields, logo). |
| 11 | **Human review (mandatory)** | `mvp_report.py <out_dir> --stamp-visual` | A human inspects `free.pdf`/`pro.pdf`/`preview.png` page by page, then stamps. No edition publishes straight from the generator. |
| 12 | **Publish / export / sync** | `export_content.py` → `publish.py` → `web/scripts/sync-db.mjs` | Export content to `web/content/`, upload free + Pro files to private R2, sync the DB (idempotent; apply to both Neon branches). `out_dir` MUST be `reports/<date>/<slug>`. |

**Output per run:** `reports/YYYY-MM-DD/<INSTRUMENT>/` → `free.pdf`, `pro.pdf`, `free.html`, `pro.html`, `metadata.json`, `preview.png`.

**Language rules (QA-enforced):** Research view / Long-biased / Short-biased / Conditional setup / Invalidation / No-trade. Never "you should buy/sell", "sure trade", "risk-free", "easy profit". "Guaranteed"/"personal recommendation" only in negated compliance form. R:R is rendered by the engine ("T1 1.5x; T2 2.1x") — never hand-typed.

### Drive it

Engine (Python 3.10+): `pip install -r requirements.txt`, then from [Claude Code](https://claude.com/claude-code):

```
/mvp WTI
/mvp BTC
/mvp AAPL
```

The deterministic parts also run standalone (always confirm flags with `--help`):

```
python scripts/intraday.py GC=F --name XAUUSD --hrange 10d --anchor prior-completed --roll-utc 22
python scripts/score_report.py data/predictions/XAUUSD_predictions.json --dry-run
python scripts/calibrate.py --dry-run
python scripts/scaffold_payload.py XAUUSD --session-profile cme_futures --check
python scripts/mvp_report.py data/payloads/XAUUSD_af_payload.json
```

### Shared infrastructure

`intraday.py` (data + `--anchor` + shared `compute_pivots_bands()`) · `taxonomy.py` (the one prediction vocabulary + validators) · `research_pack.py` (sourced context) · `social_pack.py` (optional soft signal) · `ledger_context.py` (ledger-as-input) · `scaffold_payload.py` (payload + predictions compiler) · `confidence.py` (deterministic confidence) · `calibrate.py` (isotonic map) · `report_pdf.py` (charts) · `sessions.py` (session profiles: `cme_futures`, `fx_spot`, `crypto_24_7`, `us_equity_rth`) · `mvp_report.py` (generator + QA gate) · `score_report.py` (append-only ledger) · `research_memory.py` (reasoning-level learning; future) · `social_posts.py` (safe-worded distribution drafts, no auto-posting) · `test_firewall.py` (proves marketing metrics never reach research scoring) · `publish.py` / `export_content.py` / `web/scripts/sync-db.mjs` (publish workflow).

---

## 4. Web app

The live product is a **Next.js 16 (App Router)** app in `web/`.

> **Note:** this is a pre-release Next.js with breaking changes vs older docs — see `web/AGENTS.md`. Read `node_modules/next/dist/docs/` before writing web code.

### Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) on **Vercel**, root directory `web/` |
| Auth + entitlements | **Clerk** (`@clerk/nextjs`) — subscription/admin live in `publicMetadata` |
| Subscriptions | **Lemon Squeezy** — merchant of record (handles VAT); webhook drives access |
| Catalog + scored results | **Neon Postgres** (`@neondatabase/serverless`), JSON fallback if unset |
| Report files | **Cloudflare R2** — free files public, Pro files private behind 120s signed URLs |
| UI | **Tailwind v4 + shadcn/ui (Radix)** + **GSAP** motion (reduced-motion aware) + Recharts |
| Notifications | **web-push** (VAPID) primary, **Resend** email fallback |
| Analytics | **Vercel Analytics + Speed Insights**, optional GA4 (`@next/third-parties`) |
| Migrations | **node-pg-migrate** (versioned SQL in `web/migrations/`) |

### Navbar — four categories

The desktop mega-menu (and flat mobile sheet) is organised into four groups (`components/Header.tsx`):

- **Research** — Reports, Track record, Reviews
- **Product** — How it works, Pricing, FAQ
- **Developers** — Overview, MCP server, REST API
- **Company** — About, Feedback, Contact, Terms, Privacy, Accessibility

### Key pages

- **Reports** (`/reports`) — search, asset-category / confidence-band / direction / risk filters, sort, "show more" pagination. Snapshots open instantly; Pro is gated. The filter/sort taxonomy (`lib/search.ts`, `lib/taxonomy.ts`) is reused across track record and admin.
- **Reader** (`/reports/[date]/[slug]`) — Snapshot for everyone; Pro downloads stream from R2 via `/api/report/[...key]` only for entitled users.
- **Track record** (`/track-record`) — **Pro-only**: open calls (expand to see individual predictions), scored results, calibration, and analytics (see §7). Signed-out visitors get the public accuracy headline + an upgrade prompt.
- **Reviews** (`/reviews`) — Google reviews surfaced via `lib/google-reviews.ts`.
- **Feedback** (`/feedback`) — user feedback, collected to Neon; triaged in the admin inbox.
- **Developers** (`/developers`, `/developers/mcp`, `/developers/api`) — docs for the MCP server and REST API (see §5).
- **Account** (`/account`, `/account/subscription`) — plan status, billing portal, one-click cancel (Lemon Squeezy API with a universal portal fallback).
- **Admin** (`/admin`) — member search, edition show/hide + tier toggles, feedback inbox, admin audit log, and links to the Vercel Analytics / Speed Insights dashboards. Gated by `publicMetadata.role === "admin"` or an email in `ADMIN_EMAILS`.
- **Homepage** — hero, a compact public **forecast-ledger** strip (reports published · directional accuracy · public archive · forecasts scored), a countdown to the next edition, and the latest editions.
- **Marketing/legal** — `/how-it-works`, `/pricing`, `/faq`, `/about`, `/contact`, `/terms`, `/privacy`, `/accessibility`.

Public listing pages use **ISR** (`revalidate`) — served from a cached static render, refreshed in the background.

### Run it locally

```
cd web
cp .env.example .env.local   # paste your keys (Clerk alone is enough to see auth working)
npm install
npm run dev                  # http://localhost:3000
npm test                     # vitest (filtering/sorting + a11y axe smoke + security)
npm run build                # production build
npm run migrate:up           # apply DB migrations
npm run sync-db              # load content/*.json into Neon (after migrating)
npm run db:setup             # migrate, then sync — the usual publish step
```

Public pages work with no keys; sign-in, Track record, Pro and Admin need the keys in §8.

### Repository layout

```
mvp/
  README.md                  this file (the human overview)
  CLAUDE.md                  AI project rules for the engine (KEEP)
  scripts/                   Python engine (see §3)
  data/                      candles / analysis / research / social / briefs / payloads / predictions (gitignored)
    briefs/AAPL_research_brief.json   example research brief (the one hand-authored artifact)
  ledger/outcome_ledger.csv  the scored track record (append-only)
  ledger/calibration_map.json + research_memory.json
  reports/YYYY-MM-DD/<INSTR>/  generated report pairs
  logo/                      brand assets + favicon pack
  web/                       Next.js app (the live product)
    AGENTS.md, CLAUDE.md     AI instructions for web code (KEEP)
    app/                     routes: /, /reports, /track-record, /reviews, /feedback,
                             /developers, /account, /admin, /api/*, legal/marketing pages
    components/              UI (shadcn/ui in components/ui) + ReportsBrowser, Countdown,
                             TrackRecordAnalytics, PushToggle, admin/*, Motion.tsx (GSAP)
    lib/                     content (DB), access/entitlements, search, db, lemonsqueezy,
                             r2, push, email, google-reviews, cron, taxonomy, …
    migrations/              versioned DB migrations (node-pg-migrate; authoritative)
    scripts/sync-db.mjs      loads content JSON into Neon
```

---

## 5. MCP & API

AssetFrame exposes its catalog and track record to agents and integrations — read-only, with Pro gated.

### MCP server (`/api/mcp`)

A Model Context Protocol server (Streamable HTTP, `mcp-handler` + `@clerk/mcp-tools`) with **five tools** (`app/api/mcp/route.ts`):

| Tool | Auth | Returns |
|---|---|---|
| `list_reports` | none | Published editions (Snapshot metadata: instrument, status, risk, confidence, window); filter by asset class / status / date. |
| `search_reports` | none | Reports by instrument name or ticker. |
| `get_report` | none | One report's free Snapshot + metadata + a short-lived PDF link. |
| `get_track_record` | none | Public track record: scored count, hit rate, streaks, per-confidence calibration. |
| `get_pro_report` | **Clerk OAuth + active Pro** | Full Pro analysis text + a short-lived Pro PDF link. |

Free tools need no token; `get_pro_report` enforces auth itself (the handler wraps with `experimental_withMcpAuth({ required: false })`, with OAuth discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`). Connect from Claude, Cursor, etc. — see `/developers/mcp`.

### REST API (`/api/v1`)

Read-only JSON for the catalog and record:

- `GET /api/v1/reports` — list/search editions.
- `GET /api/v1/reports/[date]/[slug]` — one report.
- `GET /api/v1/track-record` — the public track record payload.
- `GET /api/v1/openapi.json` — the **OpenAPI** spec for the above.

Human docs live at `/developers/api`.

---

## 6. Notifications

New-edition alerts go out by two channels:

- **Web push (primary)** — VAPID + a service worker + the `push_subscriptions` table (migration `…_push_subscriptions.js`). `lib/push.ts` / `lib/push-actions.ts` manage subscriptions; `components/PushToggle.tsx` is the opt-in control. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Email (fallback)** — Resend (`lib/email.ts`), to newsletter subscribers (double opt-in via `/api/subscribe` → `/api/subscribe/confirm`, unsubscribe via `/api/unsubscribe`). Needs `RESEND_API_KEY`, `RESEND_FROM`.

A **daily cron** (`vercel.json` → `0 7 * * *` → `/api/cron/new-editions`, logic in `lib/cron.ts`) detects newly published editions and fans out the push + email digest. The endpoint is protected by `CRON_SECRET`.

---

## 7. Track record & ledger

The **append-only** `ledger/outcome_ledger.csv` is AssetFrame's spine. Its first 13 columns are the original schema; V2 appended additive trailing columns `conf_version, conf_raw, asset_class, pred_type, direction, horizon, market_regime` (legacy rows read these back as `""`). Rows are never edited or reordered, and an incomplete window is never scored.

Surfaced on `/track-record` (`components/TrackRecordAnalytics.tsx`, fed by `export_content.py` → Neon via the `track_record_analytics` migration):

- **Per-instrument**, **per-asset-class**, **per-prediction-type**, and **per-market-regime** hit rates.
- The **calibration curve** — predicted confidence vs realized hit rate (buckets `<=60` / `61-75` / `>75`; meaningful at ≥10 rows).
- **Hit-rate-over-time** — the record as it grows.
- Open calls (expandable to their individual predictions), scored results, current/longest streak.

**Free vs Pro split:** signed-out and free visitors see the **public accuracy headline** (and the homepage forecast-ledger strip); the full open-calls list, scored results, and analytics are **Pro-only**.

---

## 8. Deployment

GitHub → Vercel with auto-deploy. A GitHub Action (`.github/workflows/ci.yml`) runs tests + a build on each push as a safety gate.

### One-time setup

1. **GitHub** — push this repo (or `gh repo create assetframe --private --source . --push`).
2. **Vercel** — Add New → Project → import the repo. **Root Directory = `web/`** (the app is in a subfolder). Framework preset = Next.js (auto). Add the env vars below under Settings → Environment Variables, then Deploy and add your custom domain.
3. **Lemon Squeezy** — create a Store → Product → Subscription, set the price. Copy the buy link into `NEXT_PUBLIC_CHECKOUT_URL`. Add webhook `https://<domain>/api/webhooks/lemonsqueezy` subscribed to `subscription_*`, copy its signing secret into `LEMONSQUEEZY_WEBHOOK_SECRET`. The webhook verifies the HMAC signature, then flips the buyer's Clerk account to Pro (matched by email).
4. **Clerk** — create an application, set sign-in/up paths to `/sign-in` and `/sign-up`, copy the keys, and add the Clerk webhook (`/api/webhooks/clerk`) so deleting an account cancels its sub.
5. **Cloudflare R2** — create a **private** bucket (`assetframe-pro`), create an API token, set the four `R2_*` vars. `python scripts/publish.py` uploads files as `<date>/<slug>/{free,pro}.{html,pdf}`; the app serves Pro only via 120s signed URLs.

### Two branches → two environments

- **`main` → Production** — live Clerk / Lemon Squeezy keys, the Neon `main` branch, served at **`www.assetframe.co.uk`**.
- **`development` → Preview** — test keys, the Neon `development` branch, its own `*.vercel.app` URL.

Push to either branch and Vercel rebuilds. Absolute URLs resolve per environment (`site.config.ts` + re-exposed `VERCEL_*`). Publishing updates **both** Neon branches in one `npm run sync-db` (`DATABASE_URL` + `DATABASE_URL_DEV`).

### Publishing routine

```
/mvp ETH   /mvp SOL   ...                  # generate (scores yesterday first); HUMAN REVIEW before continuing
python scripts/export_content.py           # refresh catalog + track record + free assets into web/
python scripts/publish.py                  # push free + Pro files to R2
(cd web && npm run sync-db)                # load into Neon (both branches)
git add -A && git commit -m "edition: <date>" && git push   # Vercel auto-redeploys
```

### Environment variables

Configured (see `web/.env.example`): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CHECKOUT_URL`, `NEXT_PUBLIC_PRO_PRICE`, `NEXT_PUBLIC_ANALYTICS_URL`, `NEXT_PUBLIC_LEMON_PORTAL_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GA_URL`, `DATABASE_URL`, `DATABASE_URL_DEV`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `ADMIN_EMAILS`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_VARIANT_IDS`, `CHECKOUT_TOKEN_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

> Real secrets live **only** in Vercel env vars and your local `web/.env.local` (gitignored) — never in the repo.

#### ⚠️ Outstanding env to set before the new features go fully live

These power features already shipped in code but are **not yet in `.env.example`** — set them in Vercel (and `.env.local`):

- **Web push:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- **Email fallback (Resend):** `RESEND_API_KEY`, `RESEND_FROM`
- **Google reviews:** `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID`
- **Cron auth:** `CRON_SECRET`

---

## 9. QA & Accessibility

### The QA gate (generation)

`mvp_report.py` aborts the build on any violation. Most V2 identity checks pass *by construction* (the scaffold built them) but remain as regression guards: price triple-equality (CSV == canonical == header), levels↔setups↔ladder↔ledger identity, R:R lint, banned-language scan, free/pro content split, UTC-normalized timestamps, no look-ahead, session fields present, logo present. **V2-specific:** brief `claims[]` must trace to the research pack (unsupported high-impact → `THESIS_BLOCKED`), social must be labelled "market conversation" (never fact), `primary_prediction.type` must be in the taxonomy enum, and predictions may reference only canonical level ids. Then a **human** reviews every edition (`--stamp-visual`).

### Test suites (web)

- `npm test` — **Vitest**: filtering/sorting logic, security-critical paths (webhook HMAC verification, subscription lifecycle, the Pro-download path-traversal guard), and `vitest-axe` smoke tests asserting no axe violations on key components.
- `npm run lint` — ESLint incl. `eslint-plugin-jsx-a11y`.
- `python scripts/test_firewall.py` — proves `social_engagement` (marketing metrics) is firewalled from research scoring: marketing data can never influence a confidence number.

### Accessibility — WCAG 2.2 AA

AssetFrame commits to **WCAG 2.2 Level AA**; the public statement is at `/accessibility`. Conformance work applied (the internal record):

- **Skip link** (`AppFrame.tsx`) → `<main id="main-content">` (2.4.1).
- **Accessible names**: search inputs and every filter `Select` carry `aria-label`s across ReportsBrowser, OpenCallsBrowser, admin browsers, ScoredResults (1.3.1 / 4.1.2).
- **Colour contrast** (1.4.3): hero secondary text raised to `white/70`; status/risk badge backgrounds darkened so white text clears 4.5:1.
- **Target size** (2.5.8): footer social links are a ≥36px hit area with descriptive `aria-label`s; SVGs `aria-hidden`.
- **Pager/disclosure names**: Prev/Next and the open-call expand toggle carry `aria-label`s.

**Verified baseline:** `<html lang="en">`, header/main/footer landmarks, Radix/shadcn keyboard + ARIA primitives, `prefers-reduced-motion` honoured (`Motion.tsx` + `globals.css`), focus-visible rings, single-`h1` hierarchy, image `alt` text, zoom not disabled. Before any UI release, run the manual keyboard-only + screen-reader (NVDA/VoiceOver) checklist and update the "Last reviewed" date in `app/accessibility/page.tsx`.

### Security

Security headers (HSTS, nosniff, frame SAMEORIGIN, referrer, permissions-policy) in `next.config.ts`; webhook signatures verified timing-safe before any access is granted; secrets are server-only (`NEXT_PUBLIC_*` only on the client); R2 signed URLs expire in 120s and Pro files are never in the public bundle. To harden further once domains are set: a Content-Security-Policy (added deliberately so an over-tight policy can't break Clerk) and rate limiting on `/api/*`.

---

## 10. Role, limits & disclaimer

AssetFrame publishes **general market research and decision support**. It is **not** investment advice, **not** a personal recommendation, and it **executes no trades** — there is no order-placement path anywhere in the system.

**No-auto-trading (hard rule):** the system never places, modifies, or cancels any order on any brokerage, regardless of what a report concludes. If asked to execute, it refuses and explains it is decision-support only.

No outcome is guaranteed; markets are uncertain and capital is at risk. Do your own research and consider an FCA-authorised adviser. Before charging real money, the disclaimer should be reviewed by a solicitor familiar with FCA financial promotions, and reports for paying customers should be generated on compliant/licensed data feeds (the engine has the provider switch: `ADVISOR_DATA_PROVIDER` / `EODHD_API_KEY` in `scripts/intraday.py`; futures `=F` always stay on Yahoo).

**Disclaimer wording (carried on every report and page):** *"AssetFrame publishes general market research and decision support. It is not investment advice, not a personal recommendation, and executes no trades. No outcome is guaranteed; markets are uncertain and your capital is at risk. Do your own research and consider an FCA-authorised adviser."*

**Copyright.** The reports, site, brand and code are © AssetFrame. Pro and Snapshot reports are licensed for the subscriber's personal, non-commercial use — redistribution, resale or public sharing is prohibited (Terms §8–9). Report files are served only through the auth-gated `/api/report` route as short-lived signed URLs, never as public objects.
