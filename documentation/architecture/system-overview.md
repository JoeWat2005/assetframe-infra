# System overview

> Part of the AssetFrame `/documentation` vault → `architecture/`.
> Companion docs: [generation-pipeline.md](./generation-pipeline.md) ·
> [distribution-pipeline.md](./distribution-pipeline.md) ·
> [data-flow.md](./data-flow.md) · [trust-boundaries.md](./trust-boundaries.md) ·
> [directory-map.md](./directory-map.md)

## What AssetFrame is

AssetFrame is a **publishing house, not a live API** (`mvp/README.md` §1). A curated
*edition* for one instrument is generated on a schedule, reviewed by a human, published
once, and then every reader downloads the same pre-built files from a zero-egress CDN
(Cloudflare R2). User count barely affects cost or speed — this is the deliberate
architectural choice that separates it from a real-time quant service.

Each instrument run produces a **two-tier report pair**:

- **AssetFrame Snapshot** — free, one page (status & risk badges, expected range, one
  chart, the thesis, a Bull/Base/Bear matrix).
- **AssetFrame Pro** — paid, 3–6 pages (verdict box, price ladder, long/short setups with
  R:R, scenario matrix, event-risk timeline, options/positioning context where sourceable,
  the trade-quality scorecard, the outcome ledger and a full source audit).

The product rests on one promise: **accountability**. Every Pro edition registers
falsifiable, machine-checkable predictions about the *next* session. Those predictions are
scored against the actual tape after their window closes — into an **append-only ledger**
that nobody can quietly rewrite. The public track record, the calibration curve, and the
per-report confidence number all flow from that ledger.

This is **general market research and decision support — not investment advice, not a
personal recommendation, and it places no trades** (`mvp/README.md` §10, `mvp/CLAUDE.md`).
See [trust-boundaries.md](./trust-boundaries.md#no-auto-trading-hard-rule).

## The V2 guiding principle (the role split)

The engine principle (from `mvp/README.md` §2 and `.claude/skills/mvp/SKILL.md`):

> *Automate away fragile manual JSON, not the analyst.*

| Actor | Responsibility | Where it lives |
|---|---|---|
| **AI** | Analyst + strategist + research desk. Authors exactly **one** artifact: the research brief — directional view, thesis, prediction *intent* (type + expected move in words), scenarios, risks, conviction reasoning, sourced claims. **Never types a price.** | `data/briefs/<NAME>_research_brief.json` |
| **Python** | Compiler + validator + quant engine. Builds every level, pivot, band, R:R, ladder, prediction, window, and integrity check; rejects unsupported numbers and claims. | `scripts/scaffold_payload.py`, `scripts/intraday.py`, `scripts/sessions.py`, `scripts/taxonomy.py` |
| **Ledger** | Memory + calibration + proof. Feeds history *into* the brief (under a hard no-look-ahead rule) and records scored-after-the-fact outcomes. | `ledger/outcome_ledger.csv`, `scripts/ledger_context.py`, `scripts/research_memory.py` |
| **Confidence** | Deterministic, auditable score. The AI *explains* it; it never *sets* it. | `scripts/confidence.py`, `scripts/calibrate.py` |
| **Social** | Optional, subtract-only. May only *reduce* confidence, never raise it; never a factual source. | `scripts/social_pack.py`, `confidence.social_adjustment()` |
| **Human** | Final reviewer. No edition publishes without a visual + editorial sign-off. | `scripts/mvp_report.py <out_dir> --stamp-visual` |
| **Website** | Trust + delivery. Publishes editions, surfaces the track record, gates Pro. | `web/` (Next.js 16 on Vercel) |

The single hand-authored artifact is the research brief. Everything numerical or
structural is **compiled and validated by Python** — verified in
`scaffold_payload.py` (the brief carries no prices; the scaffold reads `canonical.last_price`
straight from the hourly CSV's last close, lines 71-81 and 609) and in the `mvp_report.py`
QA gate (lines 795-957).

## The two planes

AssetFrame splits cleanly into a generation plane and a distribution plane. The boundary
between them is small and explicit: **only `web/content/*.json` and
`ledger/outcome_ledger.csv` are meant to cross into git/Neon** (`README.md` §2 end;
`SKILL.md` step 12).

### 1. Generation plane (local, mostly gitignored)

A Python engine (stdlib + `fpdf2` for PDFs, `boto3` for the R2 upload) driven by the
agentic `/mvp` skill inside Claude Code. It pulls market data, researches catalysts, lets
the analyst author one brief, compiles the canonical payload + predictions, computes a
deterministic confidence score, renders the PDFs/HTML through a QA gate, and stops for
human review. See [generation-pipeline.md](./generation-pipeline.md).

Working artifacts live under `mvp/data/` and `mvp/reports/` and are **gitignored**
(verified in `mvp/.gitignore`):

| Directory | Holds | Tracked? |
|---|---|---|
| `data/candles/` | hourly + daily OHLC CSVs | gitignored |
| `data/analysis/` | engine analysis JSON (`intraday.py` output) | gitignored |
| `data/research/` | sourced research packs | gitignored |
| `data/social/` | optional social packs | gitignored |
| `data/ledger_context/` | per-instrument ledger context | gitignored |
| `data/briefs/` | the hand-authored research brief | gitignored |
| `data/payloads/` | compiled canonical report payloads | gitignored |
| `data/predictions/` | registered predictions awaiting scoring | gitignored |
| `data/social_posts/` | distribution drafts (no auto-posting) | gitignored |
| `reports/<date>/<slug>/` | generated `free`/`pro` `.pdf`/`.html` + `metadata.json` + `preview.png` | gitignored |

See [directory-map.md](./directory-map.md) for the read/write mapping per script.

### 2. Distribution plane (Next.js 16 app in `web/`, on Vercel)

The live product: a reports browser, a Pro-gated track record + analytics, gated Pro
downloads, Clerk auth/entitlements, Lemon Squeezy (merchant-of-record) subscriptions, Neon
Postgres for the catalog/scored results, Cloudflare R2 for the report files, a Model
Context Protocol server at `/api/mcp` and a read-only REST API at `/api/v1`. See
[distribution-pipeline.md](./distribution-pipeline.md) and `README.md` §4–5.

Two git branches map to two environments (`README.md` §8): `main → Production`
(live keys, Neon `main` branch, `www.assetframe.co.uk`) and `development → Preview` (test
keys, Neon `development` branch, a `*.vercel.app` URL). One `npm run sync-db` updates
**both** Neon branches (`DATABASE_URL` + `DATABASE_URL_DEV`) — see
`web/scripts/sync-db.mjs`.

## The accountability promise (how it is mechanical, not editorial)

The "scored after the fact" claim is enforced by code, not by good intentions:

1. **Predictions are registered up front.** `scaffold_payload.py` emits
   `data/predictions/<NAME>_predictions.json` (P1..P6 falsifiable predictions, each bound
   to a canonical level id, plus a taxonomy block). `payload.confidence ==
   predictions.confidence` by construction (lines 633-644).
2. **Scoring happens only after the window closes, and first.** Each new run scores any
   expired prediction window before doing anything else (`score_report.py`); an open window
   is refused unless `--force` (lines 226-230). Verdicts are Y / N / NT / MANUAL; hit rate
   counts Y / (Y + N).
3. **The ledger is append-only.** `score_report.py` only ever *appends* a row and writes the
   header on first creation (lines 268-275). No module rewrites or reorders rows.
4. **History feeds back without look-ahead.** `ledger_context.py` and `research_memory.py`
   aggregate **only** rows whose `window_end_utc` is strictly before `--as-of` (default now)
   — `ledger_context.load_rows()` line 56, `research_memory.load_rows()` line 52.
5. **The public record is derived, never hand-edited.** `export_content.py` reads the ledger
   + predictions and writes `web/content/track-record.json`; `sync-db.mjs` loads it into Neon.

### Current state: day-one / empty ledger

As of this writing the system is at the **day-one state**. `ledger/outcome_ledger.csv`
**does not yet exist** in the repo — only `ledger/calibration_map.json` (an identity map,
`n_rows: 0`) and `ledger/research_memory.json` are present (`mvp/ledger/`). Predictions have
been registered (`data/predictions/*_predictions.json` exists for many instruments) but
none have been scored yet, so there is no `outcome_ledger.csv`.

`score_report.py` **creates** the ledger on first append — it writes the header row if the
file is new (`score_report.py` lines 270-274). Every downstream consumer degrades
gracefully on the empty case: `ledger_context.load_rows()` returns `[]` when the file is
missing (line 51), `calibrate.py` writes a valid identity map for an empty/young ledger
(docstring "Exit 0 always"), and `export_content._build_aggregates()` returns empty arrays
when there are no rows (lines 123-126). So "the ledger" referenced elsewhere in this vault
describes the **mechanism**, not a populated file that exists today.

> Note on what reaches git: `mvp/.gitignore` keeps `ledger/outcome_ledger.csv` **tracked**
> (it is the source of truth) while gitignoring the derived `ledger/calibration_map.json`
> and `ledger/research_memory.json`. Because `outcome_ledger.csv` has never been written, it
> is not in git yet either — `NOT VERIFIED` whether the first scored run will be committed
> manually; confirm against the publish routine in
> [distribution-pipeline.md](./distribution-pipeline.md).

## Where to go next

- Full 12-step generation flow, commands, and edge cases →
  [generation-pipeline.md](./generation-pipeline.md)
- Export → R2 → Neon, signed URLs, the `/api/report` gate →
  [distribution-pipeline.md](./distribution-pipeline.md)
- A single figure traced end-to-end → [data-flow.md](./data-flow.md)
- Every security boundary + the test that guards it →
  [trust-boundaries.md](./trust-boundaries.md)
- Annotated repo map → [directory-map.md](./directory-map.md)
