# AssetFrame documentation vault

> *"Next-session market intelligence, scored after the fact."*

This is the index for the AssetFrame `/documentation` vault — the engineering and product
reference for the AssetFrame platform. The human overview lives in
[`mvp/README.md`](../README.md); the AI operating manual for generating a report lives in
[`.claude/skills/mvp/SKILL.md`](../../.claude/skills/mvp/SKILL.md). This vault is the
*detailed* reference behind both.

**Launch-readiness: GREEN (for MVP).** See
[changelog/launch-audit.md](./changelog/launch-audit.md).

---

## What AssetFrame is

AssetFrame publishes pre-session market research and scores it after the fact. For every
instrument it covers (**futures, FX, crypto, US single stocks**) it ships a two-tier report
pair:

- **AssetFrame Snapshot** — free, one page.
- **AssetFrame Pro** — paid, 3–6 pages (`SITE.proPrice`, currently `£9.99/month`).

The product is a **publishing house, not a live API**: a curated edition is generated on a
schedule, human-reviewed, published once, and served as pre-built files from a zero-egress
CDN. Its single promise is **accountability** — every Pro edition registers falsifiable
predictions for the next session, which are scored against the tape after their window
closes into an **append-only ledger** that nobody can quietly rewrite.

It is **general market research and decision support — not investment advice, not a personal
recommendation, and it places no trades.** See
[product/disclaimers.md](./product/disclaimers.md).

> The guiding principle of the engine (V2):
> *AI = analyst / strategist / research desk. Python = compiler / validator. Ledger =
> memory + calibration + proof. Confidence = deterministic + auditable. Social = optional,
> subtract-only. Human = final reviewer. Website = trust / delivery.*

---

## How the docs are organised

The vault has **28 sections** (folders). Each section is a small set of focused Markdown
files with an index/overview page; most pages open with a `>` header that names its
companion docs and the real source files it was written from. Conventions:

- **Grounded in the actual codebase.** Pages cite real file paths (and line numbers where a
  detail is load-bearing). Anything uncertain is marked `NOT VERIFIED`.
- **Honest about day-one state.** The ledger has **0 scored rows** today and `/reviews` is
  "coming soon"; docs describe the *mechanism*, never a populated record.
- **Two planes.** Generation (the Python engine, mostly gitignored) and distribution (the
  Next.js 16 app in `web/`). Only `web/content/*.json` and `ledger/outcome_ledger.csv` are
  meant to cross between them.

### Sections by theme

- **Start here:** [architecture](./architecture/system-overview.md) ·
  [product](./product/product-overview.md)
- **The website:** [website](./website/routes.md) · [frontend](./frontend/components.md) ·
  [backend](./backend/backend-overview.md) · [seo](./seo/overview.md) ·
  [accessibility](./accessibility/overview.md) · [analytics](./analytics/overview.md)
- **The generation engine:** [report-engine](./report-engine/overview.md) ·
  [predictions](./predictions/overview.md) · [confidence](./confidence/overview.md) ·
  [ledger](./ledger/overview.md) · [research](./research/overview.md) ·
  [social](./social/overview.md)
- **Integrations & platform:** [api](./api/overview.md) · [mcp](./mcp/overview.md) ·
  [auth](./auth/overview.md) · [billing](./billing/overview.md) ·
  [database](./database/schema.md) · [storage](./storage/overview.md) ·
  [security](./security/threat-model.md)
- **Ship & run:** [deployment](./deployment/overview.md) ·
  [operations](./operations/daily-operations.md) · [admin](./admin/admin-panel.md) ·
  [testing](./testing/strategy.md) · [troubleshooting](./troubleshooting/README.md) ·
  [changelog](./changelog/launch-audit.md)

---

## System map

```
GENERATION PLANE  (Python engine + agentic /mvp team; human-reviewed; mostly gitignored)

  score_report.py  (scores expired windows FIRST, no look-ahead)  ─►  ledger/outcome_ledger.csv
        └─► calibrate.py ─► ledger/calibration_map.json
  intraday.py [--anchor]  ─┐
  research_pack.py         ├─► ledger_context.py ─► AI writes data/briefs/<NAME>_research_brief.json
  social_pack.py (OPT)    ─┘                              │  (the ONLY hand-authored artifact)
                                                          ▼
  scaffold_payload.py  (compiles canonical payload + predictions; invokes confidence.py)
                                                          ▼
  mvp_report.py  (renders Snapshot + Pro + metadata + preview; QA gate aborts on error)
                                                          ▼
                              ★ HUMAN REVIEW ★  (--stamp-visual)
                                                          ▼
  export_content.py ─► web/content/*.json    publish.py ─► R2    web/scripts/sync-db.mjs ─► Neon

DISTRIBUTION PLANE  (Next.js 16 app in web/, on Vercel)

  Reports browser · Pro-gated track record + analytics · gated Pro downloads · account + billing
  MCP server (/api/mcp) · REST API (/api/v1) · web-push + email notifications · admin console
  Clerk (auth/entitlements) · Lemon Squeezy (MoR subscriptions) · Neon Postgres · R2 · Vercel Analytics
```

Detail: [architecture/system-overview.md](./architecture/system-overview.md),
[architecture/generation-pipeline.md](./architecture/generation-pipeline.md),
[architecture/distribution-pipeline.md](./architecture/distribution-pipeline.md),
[architecture/data-flow.md](./architecture/data-flow.md).

---

## Key workflows

| Workflow | Start here |
|---|---|
| Generate an edition (the 12-step `/mvp` flow) | [architecture/generation-pipeline.md](./architecture/generation-pipeline.md), `SKILL.md` |
| Score yesterday's expired windows first | [operations/scoring-workflow.md](./operations/scoring-workflow.md), [predictions/scoring.md](./predictions/scoring.md) |
| Publish (export → R2 → Neon → deploy) | [operations/publication-workflow.md](./operations/publication-workflow.md), [report-engine/publish.md](./report-engine/publish.md) |
| How a single number flows end-to-end | [architecture/data-flow.md](./architecture/data-flow.md) |
| How Pro is gated (entitlement + signed URLs) | [billing/entitlements.md](./billing/entitlements.md), [storage/signed-urls.md](./storage/signed-urls.md) |
| Deploy / rollback | [deployment/overview.md](./deployment/overview.md), [deployment/rollback.md](./deployment/rollback.md) |
| Daily ops + incidents | [operations/daily-operations.md](./operations/daily-operations.md), [operations/incident-response.md](./operations/incident-response.md) |

---

## Ownership boundaries

This vault is written by several agents; the boundaries are deliberate so cross-links stay
stable.

- **`product/`, `changelog/`, this `README.md`, and `mvp/README.md`** are owned by the
  product/docs track (this pass).
- **Every other `documentation/` subfolder** (architecture, website, frontend, backend,
  report-engine, predictions, confidence, ledger, research, social, api, mcp, database,
  auth, billing, storage, security, testing, deployment, operations, admin, analytics,
  accessibility, seo, troubleshooting) is owned by its respective specialist track. This
  index **links into** them and does not modify them.
- **Source-of-truth precedence:** the codebase first; then `.claude/skills/mvp/SKILL.md`
  and `mvp/CLAUDE.md` / `web/AGENTS.md` for engine/web rules; then `mvp/README.md` for the
  human overview. Where this vault and a page disagree, the page closest to the code wins.

---

## Quick links to every section

All 27 folders, one line each:

| Section | What it covers | Open |
|---|---|---|
| **architecture** | The two planes, the role split, generation/distribution pipelines, data flow, trust boundaries, the annotated repo map. | [./architecture/system-overview.md](./architecture/system-overview.md) |
| **product** | What AssetFrame is, free vs Pro, the methodology, the two report types, disclaimers & compliance posture. | [./product/product-overview.md](./product/product-overview.md) |
| **website** | Every page route, access level and data source: reports browser, reader, track record, developers, account, admin, marketing/legal pages. | [./website/routes.md](./website/routes.md) |
| **frontend** | Components (shadcn/ui + Radix), forms, navigation/mega-menu, state & rendering (ISR/dynamic), UI patterns, GSAP motion. | [./frontend/components.md](./frontend/components.md) |
| **backend** | API routes, middleware (`proxy.ts`), server actions, error handling — the Next.js server layer. | [./backend/backend-overview.md](./backend/backend-overview.md) |
| **report-engine** | The Python compiler: `intraday`, `scaffold_payload`, `sessions`, `mvp_report` (QA gate), `export_content`, `publish`, generated artifacts. | [./report-engine/overview.md](./report-engine/overview.md) |
| **predictions** | What a falsifiable prediction is, the prediction files, the taxonomy, the lifecycle, and the per-mechanic scoring. | [./predictions/overview.md](./predictions/overview.md) |
| **confidence** | The deterministic confidence engine: the 50/30/20 blend + subtract-only social, hard caps, calibration, limitations. | [./confidence/overview.md](./confidence/overview.md) |
| **ledger** | The append-only outcome ledger: schema, append-only design, outcome scoring, calibration fitting, track-record export. | [./ledger/overview.md](./ledger/overview.md) |
| **research** | The sourcing layer: the research pack, the source policy, claim grading, news context. | [./research/overview.md](./research/overview.md) |
| **social** | The optional, subtract-only market-conversation feed; social intelligence; the no-auto-posting distribution drafts. | [./social/overview.md](./social/overview.md) |
| **api** | The read-only REST API at `/api/v1`: endpoints, auth/CORS, OpenAPI, examples. | [./api/overview.md](./api/overview.md) |
| **mcp** | The Model Context Protocol server at `/api/mcp`: the five tools, OAuth on `get_pro_report`, examples. | [./mcp/overview.md](./mcp/overview.md) |
| **auth** | Clerk auth & entitlements, roles/permissions, entitlement checks across pages and APIs. | [./auth/overview.md](./auth/overview.md) |
| **billing** | Lemon Squeezy (merchant of record), webhooks, the subscription lifecycle, entitlements. | [./billing/overview.md](./billing/overview.md) |
| **database** | Neon Postgres: schema, tables, migrations (`node-pg-migrate`), the `sync-db` loader, the JSON fallback. | [./database/schema.md](./database/schema.md) |
| **storage** | Cloudflare R2: report assets, public free files vs private Pro files, 120s signed URLs. | [./storage/overview.md](./storage/overview.md) |
| **security** | Threat model, auth boundaries, input validation, webhook security, security headers, CSP. | [./security/threat-model.md](./security/threat-model.md) |
| **testing** | Test strategy: unit, integration, security, accessibility, e2e — the 146-test web suite + the Python suite. | [./testing/strategy.md](./testing/strategy.md) |
| **deployment** | Vercel + GitHub auto-deploy, the two branches/two environments, Neon, R2, env vars, the production checklist, rollback. | [./deployment/overview.md](./deployment/overview.md) |
| **operations** | Daily operations, the publication & scoring workflows, debugging, incident response. | [./operations/daily-operations.md](./operations/daily-operations.md) |
| **admin** | The admin console (`/admin`): member search, edition show/hide + tier toggles, the feedback inbox, permissions, maintenance. | [./admin/admin-panel.md](./admin/admin-panel.md) |
| **analytics** | Vercel Analytics + Speed Insights and optional GA4: what's tracked and the metrics surfaced to admins. | [./analytics/overview.md](./analytics/overview.md) |
| **accessibility** | The WCAG 2.2 AA commitment: keyboard navigation, reduced motion, the conformance record. | [./accessibility/overview.md](./accessibility/overview.md) |
| **seo** | Metadata/OpenGraph, the dynamic sitemap, AI-bot-aware robots + `llms.txt`, structured data — built to be cited by LLMs. | [./seo/overview.md](./seo/overview.md) |
| **troubleshooting** | Common issues, an error reference, and an operational FAQ. | [./troubleshooting/README.md](./troubleshooting/README.md) |
| **changelog** | The launch audit report (the GREEN launch decision of record) and release history. | [./changelog/launch-audit.md](./changelog/launch-audit.md) |

---

## Launch-readiness status

**GREEN for the MVP.** The launch-readiness audit found **no Blocker and no High** findings;
the three **Medium** findings were fixed and tested, and the **Low** findings were fixed or
verified-and-accepted. `npm run build`, `npx tsc --noEmit`, `npx vitest run` (146 tests) and
the Python test files all pass, lint introduces no new errors, the engine smoke run prints
*"QA: all pre-render checks passed,"* and the social→scoring firewall holds. Full report:
[changelog/launch-audit.md](./changelog/launch-audit.md).

GREEN is for the MVP and carries a **post-launch backlog** (pre-scale hardening): `/api/*`
rate limiting (Vercel Firewall / Upstash), the CSP `script-src` nonce migration,
pre-existing react-hooks lint cleanup, the `BuyButton` `<a>`→`<Link>` change, and the
legacy unresolved-revoke fail-open path.

---

## Known limitations

Be honest about these everywhere (they are disclosed in-product):

- **Track record shows 0 scored results** — predictions are registered but no window has
  closed and been scored yet; the public methodology is shown, not fabricated numbers. See
  [product/methodology.md](./product/methodology.md), [ledger/overview.md](./ledger/overview.md).
- **Reviews are "coming soon"** — `/reviews` needs a Google Business Profile
  (`GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID`), not yet connected.
- **Email fallback is pending** Resend domain verification + `RESEND_FROM`.
- **Rate limiting and the CSP nonce migration** are pre-scale backlog, not MVP blockers.
- **Legal Terms & Privacy** are a strong starting point but need **solicitor review** before
  charging at scale. See [product/disclaimers.md](./product/disclaimers.md).
- **Data may be delayed** — the default feed is Yahoo; a licensed EODHD feed is available via
  a provider switch, but futures `=F` always stay on Yahoo.

**External prerequisites** (satisfied for launch): VAPID env (set), `CRON_SECRET` (set),
migrations applied to **both** Neon branches (done), Clerk prod keys + `LEMONSQUEEZY_API_KEY`
(carried from the prior launch). Detail in
[deployment/environment-variables.md](./deployment/environment-variables.md).
