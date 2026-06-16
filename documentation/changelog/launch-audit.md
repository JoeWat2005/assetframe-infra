# Launch audit report

> Part of the AssetFrame `/documentation` vault → `changelog/`.
> This is the launch-readiness audit of record for the AssetFrame MVP. It is the
> source of truth for the GREEN launch decision referenced across the vault
> (e.g. [../README.md](../README.md), [../product/product-overview.md](../product/product-overview.md)).
> Scope basis: the launch-readiness audit brief (`LAUNCH_AUDIT.md`).

## Executive summary

A launch-readiness audit was run against AssetFrame by specialist agents — a Python-engine
reviewer, a web backend/security reviewer, and a frontend/accessibility/SEO reviewer —
plus a dedicated security review and a legal Terms/Privacy rewrite.

**Result: no Blocker and no High findings.** A small set of **Medium** issues was found and
**fixed**; a set of **Low** issues was found and either fixed or verified-and-accepted with
documentation. New automated tests were added on both the Python and web sides, and the full
verification suite passes. The MVP is assessed **GREEN for launch**, with a documented
post-launch backlog of pre-scale hardening (rate limiting, CSP nonce migration) and a set of
external prerequisites that are operational, not code, in nature.

### Finding tally

| Severity | Count | Status |
|---|---|---|
| **Blocker** | 0 | — |
| **High** | 0 | — |
| **Medium** | 3 | All **FIXED** |
| **Low** | 6 | Fixed or verified/accepted + documented |

## Launch-readiness assessment — GREEN (for MVP)

The MVP is cleared to launch. The justification:

- No Blocker or High severity findings.
- All Medium findings fixed and covered by tests.
- Build, type-check, the full web test suite, lint (no new errors) and the Python test
  files all pass (see [Verification](#verification)).
- The generation engine's QA gate and the social-to-scoring firewall both pass.
- The known limitations are honest, disclosed, and either non-blocking for an MVP or
  operational prerequisites rather than code defects.

GREEN is **for the MVP**: it explicitly carries a post-launch backlog (below) that should be
worked before scaling traffic or taking material payment volume.

## Findings by severity

Each finding is classified Blocker / High / Medium / Low per the audit brief.

### Blocker — none
No issue was found that must block launch.

### High — none
No high-severity issue was found.

### Medium (all FIXED)

1. **Report-reference input validation before DB lookup.**
   The v1 REST API and the MCP server accepted `[date]/[slug]` inputs that flowed toward a
   DB lookup. These are now **validated via `isValidReportRef` before the lookup**, closing
   any malformed/injection-shaped input path. *Status: FIXED.*
   See [../security/input-validation.md](../security/input-validation.md),
   [../api/endpoints.md](../api/endpoints.md), [../mcp/tools.md](../mcp/tools.md).

2. **Push `removeSubscription` authorization.**
   The push `removeSubscription` action now **requires auth and is scoped to the caller's
   `clerk_user_id`**, so a subscription can only be removed by its owner. *Status: FIXED.*
   See [../security/auth-boundaries.md](../security/auth-boundaries.md), `mvp/README.md` §6.

3. **Cron auth timing-safe comparison.**
   The cron endpoint's secret check now uses a **timing-safe comparison (`timingSafeEqual`)**
   instead of a plain string compare, removing a timing side-channel on `CRON_SECRET`.
   *Status: FIXED.*
   See [../security/webhook-security.md](../security/webhook-security.md),
   [../testing/security-tests.md](../testing/security-tests.md).

### Low (fixed)

- **External links announce "(opens in a new tab)."** External anchors now carry an
  accessible new-tab announcement. *FIXED.* See
  [../accessibility/overview.md](../accessibility/overview.md).
- **`sw.js` unused variables** removed. *FIXED.*
- **Pre-existing a11y matcher TypeScript typing** corrected so `tsc` is clean. *FIXED.*
  See [../testing/accessibility-tests.md](../testing/accessibility-tests.md).

### Low (verified / accepted, documented)

- **Report-view unauthenticated counter.** The report-view counter accepts unauthenticated
  input by design; it is **input-validated and firewalled from scoring** (it can never
  influence a confidence number or a ledger row). Verified and accepted.
  See [../architecture/trust-boundaries.md](../architecture/trust-boundaries.md).
- **CORS `*` on public no-auth GETs.** The public REST API sets `Access-Control-Allow-Origin: *`.
  This is intentional for a public, read-only, **no-credentials** API. Verified and accepted.
  See [../api/auth.md](../api/auth.md).
- **Lemon Squeezy webhook string-timestamp idempotency.** The LS webhook uses a
  string-timestamp idempotency check. Verified and accepted for the current volume.
  See [../billing/webhooks.md](../billing/webhooks.md).

## Security report

The dedicated security review confirmed the platform's trust boundaries hold:

- **Webhook signatures verified timing-safe** before any access is granted (Lemon Squeezy +
  Clerk). See [../security/webhook-security.md](../security/webhook-security.md).
- **Pro file bytes are gated twice** — at the page layer (entitlement) and again at the
  `/api/report` API layer — and only ever served as **120-second R2 signed URLs**; Pro files
  are never in the public bundle. See [../storage/signed-urls.md](../storage/signed-urls.md).
- **Path-traversal guard** on the Pro-download key (report-key traversal tests added).
  See [../testing/security-tests.md](../testing/security-tests.md).
- **Secrets are server-only** (`NEXT_PUBLIC_*` only on the client).
- **Security headers** (HSTS, nosniff, frame SAMEORIGIN, referrer, permissions-policy) set
  in `next.config.ts`. See [../security/security-headers.md](../security/security-headers.md).
- **The social-to-scoring firewall passes** — marketing/engagement metrics can never reach
  research scoring (`scripts/test_firewall.py`). See
  [../social/overview.md](../social/overview.md).

The three Medium fixes above were the security review's primary actionable output. Full
model: [../security/threat-model.md](../security/threat-model.md).

## Business-logic review

- **Entitlement matrix** (signed-out / free / Pro / admin-comp) verified across the reader,
  track record and MCP/API surfaces; covered by the entitlement-matrix tests. See
  [../billing/entitlements.md](../billing/entitlements.md).
- **Free/Pro split** verified end-to-end: the QA gate + `_assert_free_split` keep Pro-only
  content out of the free Snapshot, and the scaffold writes `payload.confidence ==
  predictions.confidence` so the displayed and scored numbers cannot diverge. See
  [../product/free-vs-pro.md](../product/free-vs-pro.md).
- **Append-only ledger + no-look-ahead** verified by the Python suite (scoring-first,
  append-not-rewrite, the strict `window_end_utc < as_of` read filter). See
  [../ledger/append-only-design.md](../ledger/append-only-design.md).
- **Confidence determinism + social subtract-only** verified (identical inputs produce an
  identical output; social clamped to `[-10, 0]`). See [../confidence/overview.md](../confidence/overview.md).

## Accessibility (WCAG 2.2 AA)

AssetFrame targets **WCAG 2.2 Level AA** (public statement at `/accessibility`). The audit's
a11y work:

- External links now announce "(opens in a new tab)" (Low, fixed).
- The pre-existing a11y matcher TypeScript typing was fixed so `tsc` is clean (Low, fixed).
- `vitest-axe` smoke tests assert no axe violations on key components, and the manual
  keyboard + screen-reader checklist remains the pre-release gate.

Verified baseline (unchanged): skip link to `<main id="main-content">`, header/main/footer
landmarks, accessible names on search/filter controls, colour-contrast fixes, at-least-36px
target sizes on footer social links, Radix/shadcn keyboard + ARIA primitives,
`prefers-reduced-motion` honoured, focus-visible rings, single-`h1`, image `alt` text, zoom
not disabled. See [../accessibility/overview.md](../accessibility/overview.md) and
[../accessibility/wcag.md](../accessibility/wcag.md).

## Performance

- Public listing pages use **ISR** (`revalidate`) — served from a cached static render,
  refreshed in the background — so reader-facing pages stay fast at any traffic.
- The "publishing house, not a live API" model means user count barely affects cost or speed;
  report files are pre-built and served from a zero-egress CDN (R2).
- `npm run build` completes clean (exit 0). No performance regression was identified.

One performance-relevant cleanup remains in the backlog (the `BuyButton` `<a>`-to-`<Link>`
change) — non-blocking.

## SEO

The SEO surface was reviewed and is launch-ready:

- Per-page + sitewide metadata, OpenGraph/Twitter, canonical, all built from `SITE.url`
  (per-environment base-URL discipline so previews never emit production canonicals).
- Dynamic sitemap (static routes + every edition), AI-bot-aware `robots.txt`, `llms.txt`,
  and a JSON-LD graph (Organization / WebSite / SoftwareApplication / Dataset / Article /
  FAQPage / Breadcrumb).
- Private/auth surfaces (`/admin`, `/account`, `/api/`, sign-in/up) excluded from crawl.

See [../seo/overview.md](../seo/overview.md).

## Test coverage (added by the audit)

**Python — ~165 tests across 9 `test_*.py` files:**
taxonomy; confidence caps/blend/calibration; calibrate (PAVA + shrinkage); `score_report`
mechanics + append-only; `ledger_context`/`research_memory` no-look-ahead; scaffold QA /
identity + free/pro split; `social_posts` safe-wording; sessions/anchor.

**Web — ~62 new tests:**
entitlement matrix; report-key traversal; cron auth; webhook verification; v1 shape; a11y.
**The web suite total is 146 tests across 15 files.**

See [../testing/strategy.md](../testing/strategy.md),
[../testing/unit-tests.md](../testing/unit-tests.md),
[../testing/integration-tests.md](../testing/integration-tests.md),
[../testing/security-tests.md](../testing/security-tests.md),
[../testing/accessibility-tests.md](../testing/accessibility-tests.md).

## Verification

All commands run green at audit close:

| Check | Result |
|---|---|
| `npm run build` | exit 0 |
| `npx vitest run` | **146 pass** |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | introduces **no NEW errors** (pre-existing react-hooks errors remain; see backlog) |
| 9 Python `test_*.py` files | pass |
| social-to-scoring firewall (`test_firewall.py`) | OK |
| engine smoke: `scaffold_payload AAPL` then `mvp_report` | prints **"QA: all pre-render checks passed"** |

## Code cleanup

- `sw.js` unused variables removed.
- a11y matcher TypeScript typing fixed.
- Remaining cleanups are tracked in the backlog (react-hooks lint, `BuyButton` `<a>`-to-`<Link>`)
  and are build-independent.

## Site-consistency

The audit confirmed the marketed copy matches the implementation: the pricing page's
`FREE`/`PRO` arrays match the QA-enforced free/Pro split; the FAQ's "0 scored results" wording
matches the day-one ledger state; the disclaimer (`SITE.disclaimer`) is carried consistently
across pages and API payloads; the no-auto-trading rule holds (no execution path exists).

## Launch checklist

- [x] No Blocker / High findings.
- [x] All Medium findings fixed + tested.
- [x] Low findings fixed or verified/accepted + documented.
- [x] `npm run build` exit 0.
- [x] `npx vitest run` 146 pass.
- [x] `npx tsc --noEmit` exit 0.
- [x] Lint introduces no new errors.
- [x] Python test files pass; firewall OK; engine smoke passes QA.
- [x] Full `/documentation` vault added (28 sections, ~120 files).
- [ ] Post-launch backlog scheduled (below) — pre-scale, not blocking.

## Post-launch backlog (the 12 deliverables)

Documented and **not** fixed in this pass — pre-scale / infra / operational, per
`LAUNCH_AUDIT.md`:

1. **No `/api/*` rate limiting** — needs Vercel Firewall / Upstash.
   See [../security/threat-model.md](../security/threat-model.md).
2. **CSP `script-src 'unsafe-inline'` to nonce migration deferred** (a risky rewrite that
   could break Clerk if done hastily). See [../security/csp.md](../security/csp.md).
3. **Pre-existing react-hooks setState-in-effect lint errors** — build-independent; clean up.
4. **`BuyButton` `<a>` to `<Link>`** — minor frontend consistency/perf cleanup.
5. **Legacy unresolved-revoke fail-open** path — logged; revisit.
6. **Track record currently 0 scored** — methodology is shown; the first results land as
   windows close. (State, not a defect.) See [../ledger/overview.md](../ledger/overview.md).
7. **Reviews "coming soon"** — needs a Google Business Profile (`GOOGLE_MAPS_API_KEY` +
   `GOOGLE_PLACE_ID`). See [../website/company-pages.md](../website/company-pages.md).
8. **Email fallback pending** — needs Resend **domain verification** + `RESEND_FROM`.
   See `mvp/README.md` §6.
9. **Legal T&C need solicitor review** — a strong starting point, not final sign-off.
   See [../product/disclaimers.md](../product/disclaimers.md).
10. **VAPID env** (set) — keep current across environments. See `mvp/README.md` §6.
11. **`CRON_SECRET`** (set) — keep current; rotate on schedule.
12. **Migrations applied to both Neon branches** (done) + **Clerk prod keys** +
    **`LEMONSQUEEZY_API_KEY`** (from prior launch) — keep in sync.

> Items 1–5 are code/hardening; 6–9 are operational gaps with honest in-product messaging;
> 10–12 are environment prerequisites that were satisfied for launch and need ongoing upkeep.

## Documentation

This audit shipped alongside the full `/documentation` vault — **28 sections, ~120 files** —
indexed at [../README.md](../README.md).

## Known limitations (at launch)

- **Track record: 0 scored** — methodology shown, not fabricated numbers; first results land
  as the earliest windows close.
- **Reviews: "coming soon"** — no Google Business Profile connected yet.
- **Email fallback pending** Resend domain verification + `RESEND_FROM`.
- **Rate-limiting + CSP nonce** are pre-scale backlog, not MVP blockers.
- **Legal T&C** are a strong starting point but need **solicitor review** before charging at
  scale.

**External prerequisites** (satisfied for launch, per the audit): VAPID env (set),
`CRON_SECRET` (set), migrations applied to **both** Neon branches (done), Clerk prod keys +
`LEMONSQUEEZY_API_KEY` (carried from the prior launch).
