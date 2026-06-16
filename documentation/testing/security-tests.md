# Security tests

The security-relevant tests verify the three places where untrusted input crosses a trust boundary: the **report proxy** (path traversal), **inbound webhooks** (signature/replay), the **cron endpoint** (auth), and one cross-cutting **architecture firewall** in the Python engine. All are pure-function tests — no live R2/Clerk/Lemon Squeezy.

Run all (from `web/`): `npx vitest run tests/sec-report-key.test.ts tests/report-key.test.ts tests/sec-webhooks.test.ts tests/lemonsqueezy.test.ts tests/clerk-webhook.test.ts tests/checkout-token.test.ts tests/api-cron.test.ts`. Plus `python scripts/test_firewall.py` from `mvp/`.

## Path traversal — `tests/sec-report-key.test.ts`, `tests/report-key.test.ts`

Subject: `classifyReportKey` and `isValidReportRef` from `lib/report-key.ts`. These guard `app/api/report/[...key]/route.ts` (the only path to private R2 objects) and the REST/MCP report-detail endpoints.

The defense is an **anchored allow-list**, not a denylist. The only valid object keys are `<date>/<slug>/(free|pro).(html|pdf)` and `<date>/<slug>/preview.png`, where `<date>` is a calendar-plausible `YYYY-MM-DD` (month 01-12, day 01-31) and `<slug>` is `[A-Za-z0-9_-]+`. The regexes are linear/anchored (no nested quantifiers) so they are not ReDoS-prone (documented in the source). Tiers: `pro.*` -> subscription, `free.*` -> sign-in, `preview.png` -> public.

`sec-report-key.test.ts` is the hardened suite and rejects (returns `null`):
- traversal in many encodings: `../secret`, `../../etc/passwd`, embedded `.../../`, `..%2f..%2fetc`, `%2e%2e/...`, mixed encoding, absolute `/etc/passwd`, backslash `\..\..\windows\win.ini`, post-extension `.../../pro.pdf`, `....//....//pro.html`
- wrong shapes: bad extensions (`.exe`, `.json`, `.jpg`), hidden `.env`, impossible dates (month 13/00, day 32), whitespace in slug, query/fragment (`?x=1`, `#frag`), double extension (`free.pdf.html`), empty slug (`//pro.html`), wrong case (`PRO.HTML`), empty/whitespace strings
- valid classification: `pro.html`/`pro.pdf` -> `pro`, `free.*` -> `free`, `preview.png` -> `public`

`isValidReportRef(date, slug)` adds a `SLUG_MAX = 64` length cap (DoS/abuse guard) and is tested for: well-formed date+slug (incl. `SOL_2`, `BRK-B`); rejection of traversal/separators in the slug, impossible/malformed dates, empty and over-long slugs, and spaces/query/fragment injection.

`report-key.test.ts` is the lighter functional version of the same (happy path + basic traversal/shape rejection).

**Defense-in-depth note from the source:** DB lookups are already parameterized; `isValidReportRef` stops garbage before it ever reaches a query. The route also enforces entitlement server-side after classification (UI gating alone is never trusted).

## Webhook signature + replay — `tests/sec-webhooks.test.ts`, `tests/lemonsqueezy.test.ts`, `tests/clerk-webhook.test.ts`

Subjects: `verifyLemonSignature` and `subscriptionStateFromEvent` from `lib/lemonsqueezy.ts`; `verifyClerkWebhook` from `lib/clerk-webhook.ts`. These guard `app/api/webhooks/lemonsqueezy/route.ts` and `app/api/webhooks/clerk/route.ts` — the endpoints that grant/revoke paid access and cancel subscriptions, so a forged webhook is the highest-value attack.

### Lemon Squeezy signature (HMAC-SHA256 over the RAW body)
Tested to **accept** the genuine HMAC and **reject** every failure mode:
- missing signature (unsigned forgery)
- unset server secret (no secret => never trust)
- wrong-secret signature
- tampered body (signature no longer matches)
- malformed/wrong-length signature **without throwing** (e.g. `deadbeef`)

### Lemon Squeezy billing-state mapping (`subscriptionStateFromEvent`)
This decides whether an event grants (`true`), revokes (`false`), or leaves access unchanged (`null`):
- grants on active / on_trial / payment_success
- **keeps** access while cancelling (paid through period end) and during dunning (`past_due`)
- revokes on expired / unpaid / paused
- **always revokes on refund/chargeback regardless of reported status** (anti-fraud)
- returns `null` for unrelated events (e.g. `order_created`) and unknown statuses (leave access as-is)

### Clerk webhook (Svix `v1,<base64-hmac>` over `{id}.{ts}.{body}`)
Tested to accept a correctly signed, fresh webhook and reject:
- missing svix headers (id / timestamp / signature)
- unset server secret
- tampered body
- wrong-secret signature
- **stale timestamp** (replay, ~4000s in the past) and **future timestamp** outside the window (the replay window is ~+/-5 min)
- non-numeric timestamp **without throwing**

`clerk-webhook.test.ts` and `lemonsqueezy.test.ts` are the lighter functional duplicates; `sec-webhooks.test.ts` is the consolidated hardened version.

## Cron authorization — `tests/api-cron.test.ts`

Subject: `isAuthorizedCron` from `lib/cron.ts`, which protects `app/api/cron/new-editions/route.ts` (the daily push/email fan-out). Vercel Cron attaches `Authorization: Bearer $CRON_SECRET`.

The gate is **fail-closed** and uses a **constant-time, length-checked** compare (`node:crypto.timingSafeEqual`, which throws on unequal lengths, so length is checked first). The test neutralizes `server-only` with `vi.mock` and asserts:
- REJECTS when no `CRON_SECRET` is configured, even with a bearer header (the critical fail-closed case — a missing secret must never make the endpoint world-callable)
- REJECTS a wrong token
- REJECTS a missing `Authorization` header when a secret IS set
- REJECTS a correct secret without the `Bearer ` scheme prefix
- REJECTS a token that is a prefix/suffix of the secret (length-checked compare)
- ACCEPTS the exact `Bearer <secret>` Vercel Cron sends

## Checkout-token integrity — `tests/checkout-token.test.ts`

Subject: `signCheckoutToken` / `verifyCheckoutToken` from `lib/checkout-token.ts`, the signed token that binds a Lemon Squeezy checkout back to the signed-in Clerk user. `beforeAll` sets `CHECKOUT_TOKEN_SECRET`. Asserts:
- round-trips the signed-in user id
- rejects a tampered signature
- **cannot swap the user id under the original signature** (no forgery — proves the user id is cryptographically bound)
- rejects a token signed with a different secret (secret-rotation safe — old tokens become invalid)
- rejects empty / malformed / undefined input (returns `null`, never throws)

> Note: `CHECKOUT_TOKEN_SECRET` falls back to `CLERK_SECRET_KEY` in production (see `lib/checkout-token.ts` and `.env.example`), so the token is always signed even if the dedicated secret is unset.

## Architecture firewall — `scripts/test_firewall.py`

A bare stdlib script (not `unittest`) that enforces a one-way information barrier so popularity/marketing signals can never bias the scored track record:

- **Scoring modules must not read marketing metrics.** It scans `confidence.py`, `calibrate.py`, `ledger_context.py`, `research_memory.py`, `score_report.py`, `scaffold_payload.py` for the banned whole-words `social_engagement`, `engagement`, `impressions`, `clicks`, `report_views`, `download_log`. Any hit is a violation (with file + line).
- **The web engagement recorder must not import a scoring module.** It scans `web/lib/engagement.ts` import/require lines for scoring tokens (`confidence`, `calibrate`, `ledger_context`, `ledger`, `research_memory`, `score_report`, `scaffold_payload`, `taxonomy`).

Run: `python scripts/test_firewall.py` -> prints `FIREWALL OK` and exits 0 when clean, else lists violations and exits 1. This is also why analytics tracking (`social_engagement`, downloads, report views) is documented as **marketing-only / firewalled** in `../analytics/tracking.md`.

## Defenses verified elsewhere (not unit-tested, configured in code)

- **Security headers + CSP** are enforced in `next.config.ts` (HSTS preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` denying camera/mic/geolocation/topics, and an enforced Content-Security-Policy). `object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'`. See `../security/` (owned elsewhere) and `../deployment/production-checklist.md`.
- **Server-side authorization** on every admin server action (`app/admin/actions.ts` `requireAdmin()`), the report route, `/admin` and `/account` pages, and the push actions (a user can only delete their own `push_subscriptions` row). UI gating is never the only gate.
- **Short-lived signed URLs**: R2 credentials never leave the server; gated files get a 120s presigned URL (`lib/r2.ts`).

## Related docs

- `unit-tests.md` (full per-file catalog), `integration-tests.md` (the manual cron-auth and gating checks), `strategy.md`.
- `../analytics/tracking.md` (the firewall's other half).
