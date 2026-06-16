# Trust boundaries

> Part of the AssetFrame `/documentation` vault → `architecture/`. **This is the
> security-critical doc.**
> See also: [system-overview.md](./system-overview.md) ·
> [generation-pipeline.md](./generation-pipeline.md) ·
> [distribution-pipeline.md](./distribution-pipeline.md) ·
> [data-flow.md](./data-flow.md) · [directory-map.md](./directory-map.md)

AssetFrame's integrity rests on a small set of boundaries, each enforced in code and (mostly)
guarded by a test under `scripts/test_*.py`. This doc enumerates every one: **what it
protects, where it is enforced, and the test that catches a regression.**

---

## 1. The research–scoring firewall

**Protects:** research scoring (confidence, calibration, ledger learning) from being polluted
by *marketing* metrics. Engagement (impressions / clicks / likes / views / downloads) is a
popularity signal; if it ever fed back into confidence, bias, or outcome scoring, the system
would start optimising for **what spreads instead of what's correct**
(`scripts/test_firewall.py` header, lines 9-12).

**Enforced (by absence):** no scoring module imports or references any marketing metric, and
the web engagement recorder never imports the scoring path. The firewall is a *structural*
guarantee — there is simply no code path connecting the two.

**Test:** `scripts/test_firewall.py` (run from `mvp/`: `python scripts/test_firewall.py`).
It asserts:
- The six scoring modules — `scripts/confidence.py`, `calibrate.py`, `ledger_context.py`,
  `research_memory.py`, `score_report.py`, `scaffold_payload.py` (`SCORING_MODULES`, lines
  24-31) — contain **none** of the banned terms `social_engagement`, `engagement`,
  `impressions`, `clicks`, `report_views`, `download_log` (`BANNED_TERMS`, lines 35-42),
  matched as whole words case-insensitively (lines 73-89).
- `web/lib/engagement.ts` (`ENGAGEMENT_LIB`, line 45) has no **import/require** referencing
  the scoring/ledger stems `confidence`, `calibrate`, `ledger_context`, `ledger`,
  `research_memory`, `score_report`, `scaffold_payload`, `taxonomy`
  (`SCORING_IMPORT_TOKENS`, lines 48-57; checked only on import lines, 99-111).

Prints `FIREWALL OK` and exits 0 when clean; lists every violation and exits 1 otherwise. A
**missing** file is itself a violation (lines 79-80, 95) — you can't satisfy the firewall by
deleting the thing it checks.

---

## 2. Social is subtract-only

**Protects:** the confidence score from being *inflated* by crowd sentiment. Social is
sentiment awareness, crowding/hype/contrarian risk and catalyst discovery — never a factual
claim, never a thesis driver, never confidence generation (`social_pack.py` docstring lines
11-17).

**Enforced in code:**
- `confidence.social_adjustment()` returns a penalty that is **clamped to `−10..0`** — it can
  only subtract: `return max(-10.0, pen), …` (lines 274-291); penalties are negative
  increments for high/medium hype, high/medium crowding, and a contrarian warning.
- The whole pipeline runs without social: `scaffold_payload.main()` passes `social=None` when
  the pack is absent, and `social_adjustment(None)` returns `0.0` (line 275-276).
- Social is never a fact: `social_pack.validate()` only structures sentiment and flags
  unsourced/low-signal items into `source_gaps`; it asserts nothing (lines 94-152, "never
  asserts facts"). The hype-driven thesis *cap* (≤55) only fires when the **brief itself**
  declares social drives the thesis (`confidence._hype_thesis()` lines 303-308).

**Test:** `scripts/test_confidence.py` explicitly covers "social subtract-only (never
raises)" (test header lines 3-4).

---

## 3. No look-ahead

**Protects:** the falsifiability of the track record. A report must never be influenced by
its own outcome or any future outcome; history must be provably "before" the call.

**Enforced in code:**
- **Scoring happens after the window closes.** `score_report.py` refuses an open window
  unless `--force` (lines 226-230) and refuses a CSV that stops >75 min short (lines 242-249).
- **Aggregation filters on `window_end_utc`.** `ledger_context.load_rows()` skips any row
  where `window_end_utc` is `None` or `>= as_of` (line 56); `research_memory.load_rows()` does
  the same (line 52). Default `--as-of` is now.
- **Calibration can't feed itself.** `calibrate.py` fits on the ledger's `conf_raw` (the
  pre-calibration capped score), not the published score, and filters to the current
  `conf_version` (docstring lines 1-16, `load_points()` lines 52-54) — no feedback loop.
- **The ledger is append-only** (see boundary 6), so a past row can't be rewritten to leak
  future information.
- **The QA gate double-checks** that the prediction window does not start before the latest
  bar (`mvp_report.run_qa()` lines 936-942 — "prediction window starts before latest bar
  (lookahead)" aborts the build).

**Test:** `scripts/test_ledger_context.py` covers "the NO-LOOK-AHEAD filter (window_end
strictly before as_of)" for both `ledger_context.py` and `research_memory.py` (test header
lines 1-4).

---

## 4. Claim gating (the AI may interpret news, never invent it)

**Protects:** the thesis from resting on unsourced or stale claims. A claim that can't be
traced to a timestamped source must not drive the call.

**Enforced at three layers:**
1. **Research pack gate.** `research_pack.validate()` — every `used_in_thesis` item must
   carry a non-empty source **and** a timestamp, else **exit 2** before anything is written
   (lines 106-113). Unsourced non-thesis items are demoted into `source_gaps` (lines 115-116).
2. **Scaffold rejection.** `scaffold_payload._claims()` rejects an invalid claim status and
   any `used_in_thesis` claim whose status is `unverified`/`stale`/`unavailable` via `die()`
   → exit 2 (lines 376-387). Weakly-sourced thesis claims not traceable to the pack are
   downgraded in the catalyst component (`confidence.catalyst_confidence()` lines 247-249,
   `_claim_traced()` lines 260-269).
3. **QA re-check.** `mvp_report.run_qa()` re-validates `meta.high_impact_claims` — bad status,
   or `used_in_thesis` with a `THESIS_BLOCKED` status (`{unverified, stale, unavailable}`,
   line 66) — aborts the build (lines 885-889).

**Tests:** `scripts/test_scaffold_payload.py` covers "the claim-sourcing THESIS_BLOCKED gate"
(test header lines 1-4). The research-pack gate itself has no dedicated `test_*.py` — `NOT
VERIFIED`: add coverage or confirm it is exercised indirectly; the gate logic is in
`research_pack.validate()` lines 106-116.

---

## 5. Price integrity & data quality

**Protects:** readers from a fabricated or drifted price/level. **The AI never types a
price.**

**Enforced in code:**
- **Triple-equality.** The scaffold reads `canonical.last_price` from the hourly CSV's last
  close (`read_last_bar()` lines 71-81), so CSV == canonical by construction; `run_qa()`
  asserts canonical == CSV == `meta.last_price` and aborts otherwise (lines 803-811).
- **Every price is a canonical level.** Setups, ladder, and `ledger_levels` reference level
  *values*, not free-typed numbers (`scaffold_payload.build_setups/build_ladder/
  build_predictions_spec`, lines 184-279); `run_qa()` enforces levels↔setups↔ladder↔ledger
  identity (lines 817-845).
- **R:R is engine-rendered.** Formatted by `scaffold._fmt_rr()` (lines 172-181) to the
  `RR_OK` pattern; `run_qa()` rejects anything off-pattern or negative-looking (`RR_OK` line
  62, `RR_BAD` line 63, checks lines 836-837, 857-858).
- **Data-quality caps.** `confidence.py` caps the score on degraded data (≤50), stale data
  (≤40), cold indicators (≤60), and engine errors (≤65) — `compute_confidence()` lines
  358-374; the underlying flags come from `intraday.py`'s `freshness` / `degraded` /
  `windows.sma_warm_at_display_start` blocks (lines 213-259, 660-677). Trend is never inferred
  from a cold SMA.

**Tests:** `scripts/test_scaffold_payload.py` (QA-by-construction: every setup/ladder/ledger
price is a canonical level value); `scripts/test_confidence.py` (every hard cap, `compute_dq`);
`scripts/test_sessions_intraday.py` (the pure `compute_pivots_bands` golden math).

---

## 6. Append-only ledger

**Protects:** the track record from being quietly rewritten. "Scored after the fact" must be
mechanical, not editorial.

**Enforced in code:** `score_report.py` opens the ledger in **append mode** and only ever
adds a row; it writes the 20-column header (`LEDGER_COLS`, lines 62-66) solely when the file
is new (lines 268-275). No module edits or reorders rows. The first 13 columns are the
original schema; the trailing 7 are additive (legacy rows read them as `""`). `--force` exists
only for a deliberate PARTIAL or an early-close CSV (lines 226-230, 242-251).

**Test:** `scripts/test_score_report.py` covers "the append-only ledger write (never rewrites
existing rows)" (test header lines 1-4).

> **Day-one note.** The file does not exist yet; the first scored run creates it. See
> [system-overview.md](./system-overview.md#current-state-day-one--empty-ledger).

---

## 7. Free / Pro content split

**Protects:** the paywall — the free Snapshot must not leak Pro-only analysis (entries, R:R,
ladders, invalidation logic, source audit, the ledger, risk math).

**Enforced at two layers:**
1. **Scaffold.** `_assert_free_split()` rejects pro-only vocabulary in the brief's `free_*`
   fields (`PRO_ONLY` = `r:r, per contract, entry zone, invalidation, t1 , t2 , ladder,
   glossary, source audit, outcome ledger, hedging, risk math`, line 425; check lines
   429-438) and rejects a free chart with >3 levels or any pivots/bands (lines 436-437).
2. **QA gate.** `run_qa()` re-scans the free tier (excluding the teaser + disclaimer, which
   legitimately name Pro features) for the same banned-free vocabulary, and re-checks the
   ≤3-level / no-pivots-no-bands chart rule (lines 867-882).

**Test:** `scripts/test_scaffold_payload.py` covers "the free/pro split guard (no Pro vocab
leaks into the free Snapshot)" (test header lines 1-4). `NOT VERIFIED`: the `mvp_report.run_qa`
free-split branch is not directly unit-tested under `scripts/test_*.py` (no `test_mvp_report.py`
exists); the scaffold-layer guard is tested and the QA layer mirrors it — confirm if you need
both layers covered.

---

## 8. Distribution plane — private R2 + signed URLs

**Protects:** report files (free Snapshots **and** Pro) from being read without going through
auth. There is no public/static report object anywhere.

**Enforced in code + infra:**
- `publish.py` uploads all five file types to a **private** R2 bucket under keys
  `<date>/<slug>/{free,pro}.{html,pdf}` and `<date>/<slug>/preview.png` (`UPLOAD_FILES` lines
  33-39, `discover()` lines 58-70). Nothing is marked public.
- `export_content.py` writes **only** `catalog.json` + `track-record.json` into
  `web/content/`; report files are *not* copied to the web app (docstring lines 1-6; `_dir`
  removed before serialising, lines 383-384). Catalog asset paths point at the gated route
  `/api/report/<date>/<slug>/…` (line 95).
- The Next.js `/api/report/[...key]` route streams from R2 behind **120-second signed URLs**;
  free needs an account, Pro needs an active subscription (`README.md` §4, §8, §9, §10).

**Test:** `web/` Vitest suite covers "the Pro-download path-traversal guard" and webhook HMAC
verification (`README.md` §9). That is in the web app, not `scripts/test_*.py`.
`NOT VERIFIED` from Python-side source: the exact route handler, signing TTL, and entitlement
check — confirm against `web/app/api/report/[...key]/route.ts`, `web/lib/r2.ts`, and the
relevant `web/lib/access` / entitlement module before relying on the precise behaviour.

---

## 9. Deterministic confidence (the AI explains, never sets)

**Protects:** the confidence number from being talked up by the analyst. Same inputs → same
score, every time.

**Enforced in code:** `confidence.compute_confidence()` is a pure function of its inputs
(stdlib only; deterministic blend → caps → calibration, lines 346-391) and is invoked **by
the scaffold**, not authored — `confidence.py`'s `__main__` is only a demo (lines 394-415).
The brief carries no confidence number (`scaffold` rejects prices in the intent); the scaffold
writes the computed `published` int into both the payload and the predictions file
(`scaffold_payload.main()` lines 625-636). The Pro scorecard renders the component breakdown +
caps + calibration note from that computed dict (`_scorecard_html()` lines 529-541), and human
review checks "confidence explanation matches the computed score" (`SKILL.md` step 11).

**Test:** `scripts/test_confidence.py` covers "determinism/reproducibility" (test header line
3).

---

## 10. No-auto-trading (hard rule)

**Protects:** users and the operator from autonomous order placement. The system is
decision-support only.

**Enforced by policy + absence of a code path:** there is **no order-placement path anywhere
in the system** (`README.md` §10; `mvp/CLAUDE.md` "No-auto-trading policy"; root
`advisor/CLAUDE.md`). The system never places, modifies, or cancels any order on any
brokerage, regardless of what a report concludes; if asked to execute, it refuses and explains
it is decision-support only. The Pro disclaimer string itself ends "This system never places
trades." (`scaffold_payload.DISCLAIMER_PRO`, lines 54-57). Any Trading 212 integration is
read-only context only.

**Test:** none required — the guarantee is the *non-existence* of an execution path. (The
analogous "the system never auto-posts" property *is* tested; see boundary 11.)

---

## 11. No-auto-posting (distribution drafts)

**Protects:** the brand/channels from autonomous publishing, and readers from pump/advice
language in social copy.

**Enforced in code:** `social_posts.py` only templates four distribution drafts
(`x`, `linkedin`, `newsletter_snippet`, `reddit_summary`) into
`data/social_posts/<NAME>_<DATE>_posts.json`; it **never posts** and stamps `auto_post:
False` in the output (docstring lines 11-14, `main()` line 195). Every draft uses neutral
"AssetFrame published…" framing and expresses confidence as a band, never a promise
(`build_posts()` lines 92-135). A **safe-wording QA gate** scans every draft for pump/advice
phrases (`BANNED` lines 48-51) and allows "guaranteed" only in negated compliance form
(`GUARANTEED_OK` line 53); a hit calls `die()` → **exit 2, nothing written**
(`safe_wording_check()` lines 61-74, invoked line 185).

**Test:** `scripts/test_social_posts.py` covers "the safe-wording QA gate (pump/advice phrases
are a build error), the negated-'guaranteed' allowance, and the neutral 'AssetFrame
published…' framing" (test header lines 1-4).

---

## Summary table

| # | Boundary | Primary enforcement | Test |
|---|---|---|---|
| 1 | Research–scoring firewall | `test_firewall.py` `SCORING_MODULES` / `BANNED_TERMS` / `ENGAGEMENT_LIB` | `scripts/test_firewall.py` |
| 2 | Social subtract-only | `confidence.social_adjustment()` clamp `−10..0` (l.291) | `scripts/test_confidence.py` |
| 3 | No look-ahead | `ledger_context.load_rows()` l.56, `research_memory.load_rows()` l.52, `score_report` l.226-230, QA l.936-942 | `scripts/test_ledger_context.py` |
| 4 | Claim gating | `research_pack.validate()` l.106-113, `scaffold._claims()` l.383-384, QA `THESIS_BLOCKED` l.888-889 | `scripts/test_scaffold_payload.py` (+ `NOT VERIFIED` research-pack gate) |
| 5 | Price integrity / data quality | `read_last_bar()` l.71-81, QA triple-equality l.803-811, caps l.358-374 | `scripts/test_scaffold_payload.py`, `test_confidence.py`, `test_sessions_intraday.py` |
| 6 | Append-only ledger | `score_report.py` append + header-on-new l.268-275 | `scripts/test_score_report.py` |
| 7 | Free/Pro split | `scaffold._assert_free_split()` l.429-438, QA l.867-882 | `scripts/test_scaffold_payload.py` (+ `NOT VERIFIED` QA layer) |
| 8 | Private R2 / signed URLs | `publish.py` keys l.33-70, `export_content` writes only JSON l.383-384, `/api/report` 120s | `web/` Vitest (path-traversal); `NOT VERIFIED` Python-side |
| 9 | Deterministic confidence | `confidence.compute_confidence()` pure fn l.346-391, scaffold-invoked | `scripts/test_confidence.py` |
| 10 | No-auto-trading | no order path exists (`README.md` §10, `CLAUDE.md`) | n/a (non-existence) |
| 11 | No-auto-posting | `social_posts.py` `auto_post:False` + safe-wording `die()` l.61-74 | `scripts/test_social_posts.py` |

> Run the engine guards together from `mvp/`: `python scripts/test_firewall.py` then the rest
> of `python scripts/test_*.py`. The web-side guards run via `npm test` in `web/`
> (`README.md` §9).
