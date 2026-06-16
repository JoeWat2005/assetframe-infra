# Testing strategy

AssetFrame ships two independent test suites that guard two different layers of the system.

| Suite | Runner | Location | What it guards |
| --- | --- | --- | --- |
| Web (TypeScript) | [Vitest](https://vitest.dev) 4 | `web/tests/*` plus `web/lib/search.test.ts` | Access control, webhook signature verification, path-traversal defenses, public API/MCP payload shapes, cron auth, publish-time scheduling, and accessibility (axe). |
| Engine (Python) | `unittest` (one bare-script firewall) | `scripts/test_*.py` | The deterministic confidence engine, calibration, scoring/ledger mechanics, taxonomy, session/intraday math, payload QA-by-construction, social-post safe wording, and the research/marketing firewall. |

## Philosophy

The suites are **pure-logic-first**. Almost every test exercises a real exported function with no network, no live database, and no live Clerk/R2/Lemon Squeezy calls. This is deliberate:

- The web app's authorization and security logic was split out of its framework wrappers specifically so it could be unit-tested. `lib/access.ts` (`computeEntitlement`) carries the entitlement business logic and is pure (no `server-only`, no Clerk import); `lib/entitlements.ts` is the thin Clerk wrapper around it. Tests target the pure module.
- Webhook verification (`lib/lemonsqueezy.ts`, `lib/clerk-webhook.ts`), the cron gate (`lib/cron.ts`), and report-key classification (`lib/report-key.ts`) are all pure functions that take raw inputs and return a verdict — so a test can feed them a forged signature or a traversal payload directly.
- The Python engine is deterministic by design (see `confidence.py`): the same inputs always produce the same score, which makes golden-value assertions possible (see `scripts/test_sessions_intraday.py` and `scripts/test_confidence.py`).

## What IS tested

- Entitlement derivation across every launch-critical user state (signed-out, free, Pro, cancelled-but-not-expired, expired, admin, admin-preview) and privilege-escalation guards — `tests/access.test.ts`, `tests/api-entitlement.test.ts`.
- HMAC/Svix webhook signature verification, replay windows, and billing-state mapping including refund/chargeback revocation — `tests/lemonsqueezy.test.ts`, `tests/clerk-webhook.test.ts`, `tests/sec-webhooks.test.ts`.
- Path-traversal and malformed-key rejection for the R2 report proxy and for REST/MCP report refs — `tests/sec-report-key.test.ts`, `tests/report-key.test.ts`.
- Fail-closed cron authorization with a timing-safe, length-checked compare — `tests/api-cron.test.ts`.
- Public REST/MCP payload shape: required fields present, disclaimer always attached, no Pro keys leak, limit clamped to 1..200 — `tests/api-v1-shape.test.ts`.
- Checkout-token round-trip, tamper rejection, forgery resistance, secret-rotation safety — `tests/checkout-token.test.ts`.
- Edition search/filter (text, asset class, inclusive date range) — `tests/search.test.ts`, `lib/search.test.ts`.
- DST-aware publish scheduling (06:00 Europe/London year-round) — `tests/publish.test.ts`.
- Accessibility (no axe violations, labelled forms, heading order, accessible nav) — `tests/a11y.test.tsx`, `tests/a11y-components.test.tsx`.
- The full Python engine — see `unit-tests.md`.

## What is NOT tested (gaps)

- **No browser/E2E layer.** There is no Playwright, Cypress, or other real-browser runner. Component a11y tests run in jsdom, not a real browser. See `e2e-tests.md` for a proposed plan (marked NOT VERIFIED / planned).
- **No live-integration tests.** Nothing in CI talks to a real Neon DB, real R2 bucket, real Clerk, real Lemon Squeezy, or the real Vercel cron. The DB-touching path (`lib/db.ts`, `sync-db.mjs`, the cron route's SQL, the download-log insert) is exercised only by hand. See the manual playbook in `integration-tests.md`.
- **No coverage gate.** `vitest.config.ts` does not configure a coverage threshold; coverage is not enforced.

## Commands (quick reference)

```bash
# Web suite (run from web/)
npm test            # = "vitest run" (single pass, CI-style)
npx vitest          # watch mode for local dev
npx vitest run tests/access.test.ts   # one file

# Production build (also a test: the QA gate + type-check run here)
npm run build

# Python engine (run from mvp/)
python scripts/test_confidence.py
python scripts/test_score_report.py
python scripts/test_firewall.py
# ...one invocation per file; see unit-tests.md for the full list
```

There is no `pytest` config; each Python test file is a self-contained `unittest.main()` script (except `test_firewall.py`, which is a bare stdlib script). NOT VERIFIED: whether CI runs the Python suite automatically — no CI workflow for the Python tests was found under `web/`; `.github/` lives at the `mvp/` root and was not in this doc set's scope.

## Related docs

- `unit-tests.md` — file-by-file catalog of every test.
- `integration-tests.md` — the jsdom integration tests + the manual end-to-end playbook (incl. the web-push alert flow).
- `e2e-tests.md` — proposed Playwright plan (planned, not built).
- `security-tests.md` — the `sec-*`, report-key traversal, and webhook tests in depth.
- `accessibility-tests.md` — the vitest-axe suite.
- `../operations/publication-workflow.md`, `../operations/scoring-workflow.md` — what the Python engine produces.
