# Unit tests

This is the file-by-file catalog of the two unit suites. For the security tests in depth see `security-tests.md`; for accessibility see `accessibility-tests.md`.

## Web suite (Vitest)

Runner: Vitest 4 (`web/package.json` -> `"test": "vitest run"`). Config: `web/vitest.config.ts`.

Two config facts matter:

- The `@/...` path alias is resolved to the `web/` root (`resolve.alias`) so component tests can import the **real** components (Header, forms) rather than stubbing their whole dependency tree.
- The default environment is `node`; DOM tests opt in per file with a `// @vitest-environment jsdom` directive on line 1. `globals: false`, so tests import `describe/it/expect/vi` from `vitest` explicitly.

Several pure modules import `server-only`, which throws outside an RSC build. Those tests neutralize it with `vi.mock("server-only", () => ({}))` (e.g. `api-cron.test.ts`, `api-v1-shape.test.ts`).

### `tests/access.test.ts` — entitlement logic
Tests `computeEntitlement` from `lib/access.ts` with `ADMINS = ["admin@assetframe.co.uk"]`.
- free signed-in user: no Pro, no billing, not admin
- paid subscriber: `subscribed` AND `billingActive`, details mirrored (e.g. `subscriptionId`)
- admin by email: comped Pro WITHOUT a paid subscription (`billingActive=false`)
- admin by Clerk role: comped Pro
- admin previewing the free tier (`adminTier="free"`): keeps admin, loses Pro
- admin who ALSO pays stays subscribed while previewing free (real sub wins)
- non-admin can never self-grant via `adminTier` metadata
- normalises an empty `renewsAt` to undefined and passes cancellation state through

### `tests/api-entitlement.test.ts` — full authorization matrix
Tests `computeEntitlement` and the `SIGNED_OUT` constant. Superset of `access.test.ts`, documented as the authorization matrix that gates Pro access, downloads, MCP Pro tools, and admin pages. Adds privilege-escalation guards:
- a free user cannot self-grant admin via `adminTier`
- a free user cannot become admin via a bogus `role` string (e.g. "superuser")
- email allow-list is case-insensitive on the caller email but exact on membership (`admin@assetframe.co.uk.evil.com` is NOT admin)
- no email + no role = never admin

### `tests/api-v1-shape.test.ts` — public REST/MCP payloads
Tests `listReports`, `getReportDetail`, `getTrackRecordPayload` from `lib/reports-api.ts`. Mocks `server-only`, `next/cache` (`unstable_cache` passthrough), `@/site.config`, `lib/content`, `lib/r2`.
- wraps results with `total` / `returned` / `reports` / `disclaimer`
- each summary has exactly the documented public fields (`id, date, slug, instrument, ticker, assetClass, status, risk, bias, confidence, windowEnd, hasPro, url`) and **no Pro keys leak** (`freeHtml`, `proHtml`, `proPdf`, `hidden` absent)
- filters by `asset_class` (case-insensitive)
- filters by free-text query over instrument/ticker/slug
- clamps `limit` into 1..200 (0 and -5 floor to 1; 9999 clamps to 200; default 50)
- `confidence` is a number or null, never undefined
- `getReportDetail` returns null for an unknown edition (route then emits 404)
- track-record payload always carries the `stats` block and the disclaimer

### `tests/search.test.ts` and `lib/search.test.ts` — edition filtering
Tests `filterEditions` from `lib/search.ts`.
- returns everything with no filters
- searches instrument and ticker case-insensitively; also searches the `bias` text
- filters by asset class; combines search + filter (AND)
- returns empty when nothing matches
- inclusive `from`-date and `to`-date filters; date range; date filter combined with search

> Note: `lib/search.test.ts` sits next to the source rather than under `tests/`. Vitest discovers both by its default `**/*.test.ts` glob.

### `tests/publish.test.ts` — DST-aware publish scheduling
Tests `tzOffsetMinutes`, `localDOW`, `nextPublish` from `lib/publish.ts`. `SITE.publish` defaults: cadence `daily`, tz `Europe/London`, `hourLocal` 6.
- offset is +60 in summer (BST), 0 in winter (GMT)
- reads the local weekday
- summer: targets 06:00 BST = 05:00 UTC the same day before the drop; rolls to tomorrow once today's 06:00 BST has passed
- winter: targets 06:00 GMT = 06:00 UTC
- always returns a strictly future instant, including spring-forward/fall-back days
- the target is exactly 06:00 in London local time year-round (verified via `Intl.DateTimeFormat`)

### Security-focused web tests (full detail in `security-tests.md`)
- `tests/api-cron.test.ts` — `isAuthorizedCron` fail-closed CRON_SECRET gate.
- `tests/sec-report-key.test.ts`, `tests/report-key.test.ts` — `classifyReportKey` / `isValidReportRef` traversal + shape defenses.
- `tests/sec-webhooks.test.ts`, `tests/lemonsqueezy.test.ts`, `tests/clerk-webhook.test.ts` — `verifyLemonSignature`, `subscriptionStateFromEvent`, `verifyClerkWebhook`.
- `tests/checkout-token.test.ts` — `signCheckoutToken` / `verifyCheckoutToken`.

### Accessibility web tests (full detail in `accessibility-tests.md`)
- `tests/a11y.test.tsx`, `tests/a11y-components.test.tsx` — vitest-axe.

## Python engine suite (`unittest`)

All run from the `mvp/` root, one invocation per file. Each file ends with `unittest.main(verbosity=2)` except `test_firewall.py` (a bare stdlib script that prints `FIREWALL OK` / exits non-zero on a violation).

```bash
python scripts/test_calibrate.py
python scripts/test_confidence.py
python scripts/test_firewall.py
python scripts/test_ledger_context.py
python scripts/test_scaffold_payload.py
python scripts/test_score_report.py
python scripts/test_sessions_intraday.py
python scripts/test_social_posts.py
python scripts/test_taxonomy.py
```

### `test_confidence.py` — the deterministic confidence engine (`confidence.py`)
The largest engine test. Covers:
- blend weights: top-level `WEIGHTS` sum to 100; market sub-weights (trend, momentum, structure, rr, volatility, data_quality) sum to 1.0; published = `clamp(weighted blend, 0, 100)` rounded to 1 dp
- determinism: identical inputs -> identical output; published is an int in [0,100]
- data-quality scoring (`compute_dq`): base 7, degraded/stale/errors floor to 0, age and cold-SMA penalties, options bonus capped at 10, unsupported-claim penalty, never below zero
- social adjustment is **subtract-only** (never raises confidence); floor of -10; published-with-social <= published-without
- hard caps: stale->40, degraded->50, cold-indicators->60, engine-errors->65, unsupported-thesis->55, hype-driven-thesis->55, ledger-failure-pattern->55 (needs n>=5); lowest cap wins
- calibration application: identity passthrough with no map or <2 knots; linear interpolation; clamps outside knot range; `calibrated` flag reported
- ledger confidence component shrinks toward 0.5 at low n; percent and fraction rates equivalent
- division guards (zero risk, zero median range, no data, `wait` direction) all return 0.5
- catalyst confidence: strong multi-source claim not penalised by pack mismatch; weak untraced claim downgraded

### `test_calibrate.py` — calibration map fit (`calibrate.py`)
- PAVA isotonic regression: monotone non-decreasing output; already-monotone input unchanged; pools violations; weighted pooling
- merge-duplicate-x preprocessing (weighted mean, sorted ascending)
- identity-map fallback for an empty or below-min-rows ledger (`method="identity"`, `shrinkage_w=0.0`, knots `[[0,0],[100,100]]`); starts fitting at `min_rows=5`
- knot shape: strictly ascending x with 0.0/100.0 endpoints; monotone y; `shrinkage_w` capped at 1.0; `conf_version` recorded
- `load_points` CSV loading: missing file -> empty; filters by `conf_version`; falls back to `confidence` column when `conf_raw` empty; skips rows with no outcomes

### `test_score_report.py` — scoring + append-only ledger (`score_report.py`)
- scoring mechanics: `close_above`, `close_below`, `range_inside`, `touches`, `no_close_below`, `no_close_above`, `no_close_above_after_touch`, `no_close_below_after_touch`; manual -> `MANUAL`; empty bars -> `NT`; unknown type flagged
- `score_setup`: long t1-first, long invalidation-first, never-fills, open-at-window-end, no setup/bars
- calibration summary buckets only at >=10 rows (keys include `<=60`, `>75`)
- manual-verdict validator: unknown id and non-manual id both exit 2; valid manual id passes
- CLI arg parsing: bad verdict rejected; `--manual P5=Y,P6=NT` parsed
- window filtering from CSV is inclusive of both ends
- **append-only invariant**: two subprocess scoring runs grow the ledger by one data row and the second read begins byte-for-byte with the first; `--dry-run` writes nothing

### `test_ledger_context.py` — no-look-ahead ledger reads (`ledger_context.py`, `research_memory.py`)
- strict `window_end < as_of` filter (a row exactly at `as_of` is excluded); rows sorted by window end; malformed dates skipped
- empty-ledger neutral context (`historical_prediction_count=0`, `instrument_hit_rate=None`, "No scored history" note)
- instrument matching by ticker and partial name; prediction-type breakdowns keyed by pred_type
- research-memory mirror: cross-indexed prediction_type x regime breakdowns; `min_n` guard suppresses thin patterns

### `test_scaffold_payload.py` — QA-by-construction (`scaffold_payload.py`)
- level catalog sorted high->low, de-duped (4 dp), each level has `id/cls/label` + float value; `anchor` = last price
- **every setup/ladder/ledger price is a canonical level** (entry_lo, entry_hi, invalidation, t1, t2); ladder capped at 12, excludes `anchor`, includes every setup target + invalidation
- R:R formatting: zero-risk excluded, below-1.0x flagged, normal multiples formatted (`T1 2.0x`)
- thesis claim sourcing gate (`THESIS_BLOCKED`): weak/unverified/stale/unavailable claim used in thesis -> `SystemExit(2)`; unknown status rejected; strong multi-source allowed; weak claim OK if not in thesis
- free/Pro split: Pro vocab (`r:r`, `invalidation`, `ladder`, `source audit`, `outcome ledger`) in free bullets -> `SystemExit(2)`; teaser is exempt; free chart with >3 levels or any pivots -> blocked
- disclaimers present (`DISCLAIMER_FREE` "Not personal financial advice", `DISCLAIMER_PRO` "never places trades")

### `test_taxonomy.py` — taxonomy validators (`taxonomy.py`)
- validators reject typos for `prediction_type`, `direction`, `setup_side`, `horizon`, `asset_class`, `market_regime`; `TaxonomyError` is a `ValueError`
- `asset_class_key` mapping by profile + symbol; futures refinement (`ES=F`/`NQ=F` -> index, `CL=F`/`GC=F` -> commodity); unknown root stays `futures`; override wins and is validated; unknown profile raises
- regime derivation + alias normalization
- confidence band boundaries (<50 Low, 50-64.9 Moderate, 65-79.9 Elevated, >=80 High) and bucket boundaries (`<=60`, `61-75`, `>75`); unparseable -> Unknown/None
- `build_taxonomy` aggregate validator; `CONFIDENCE_BUCKETS == ("<=60","61-75",">75")` (mirrored by `web/lib/content.ts`)

### `test_sessions_intraday.py` — session + pivot math (`sessions.py`, `intraday.py`)
Pure offline math, no network.
- crypto 24/7 rolling window on weekends; maintenance break a no-op
- equity RTH: weekend/holiday targets next session, pre-market targets today, open targets current
- CME futures: Friday-evening-after-close targets Sunday open; midweek open targets current session
- `compute_pivots`/bands golden values (PP/R1/S1/R2/S2, inner/outer bands); no ATR -> no bands; no prior -> no pivots; None anchor close -> no bands

### `test_social_posts.py` — social-draft safe wording (`social_posts.py`)
- banned phrases ("buy now", "to the moon", "risk-free", "guaranteed to print", etc.) -> `SystemExit(2)`; negated "No outcome is guaranteed" allowed
- builds posts for `x`, `linkedin`, `newsletter_snippet`, `reddit_summary`; neutral "AssetFrame published..." framing; confidence as a band not a raw number; disclaimer + SCORED_LINE + REPORT_LINK present; generated posts pass their own gate

### `test_firewall.py` — research/marketing firewall (bare stdlib)
See `security-tests.md` for the full description. Asserts scoring modules never read marketing metrics and `web/lib/engagement.ts` never imports a scoring module. Run: `python scripts/test_firewall.py` (prints `FIREWALL OK`, exit 0 when clean).

## Related docs

- `strategy.md`, `integration-tests.md`, `e2e-tests.md`, `security-tests.md`, `accessibility-tests.md`.
- `../operations/scoring-workflow.md` — how `score_report.py` + `calibrate.py` run in production.
