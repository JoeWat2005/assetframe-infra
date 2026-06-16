# End-to-end tests

## Current state: NOT VERIFIED / none exist

**There is no automated end-to-end (real-browser) test suite in this repository.** Confirmed by inspection:

- `web/package.json` has no Playwright, Cypress, WebdriverIO, or Puppeteer dependency and no `e2e`/`test:e2e` script. The only test script is `"test": "vitest run"`.
- The "DOM" tests (`tests/a11y.test.tsx`, `tests/a11y-components.test.tsx`) run in **jsdom**, not a real browser. jsdom does not run layout, real navigation, service workers, or the Push API.
- The closest thing to E2E today is the **manual playbook** in `integration-tests.md`, which a human runs against a preview/production deploy.

`LAUNCH_AUDIT.md` lists E2E tests (homepage, navigation, reports, account, pricing, auth, gated content, mobile menu) as a *testing requirement*, but no such suite was built. Treat everything below as a **proposal, not documentation of existing behaviour**.

## Proposed E2E plan (planned — NOT VERIFIED)

Recommended runner: **Playwright** (Chromium + WebKit + Firefox; first-class service-worker, notification-permission, and route-mocking support — needed for the push flow). It would sit alongside Vitest, not replace it.

### Why Playwright specifically

- The highest-value untested path is the **web-push alert flow**, which needs a real service worker, `Notification.requestPermission`, and a real `PushManager`. Playwright can grant the `notifications` permission via `browserContext.grantPermissions(["notifications"])` and can drive the registered `/sw.js`. jsdom cannot.
- Auth redirects (`/account`, `/admin` -> `/sign-in`; Pro file -> `/pricing`) are real top-level navigations best asserted in a browser.

### Suggested specs

1. **Public navigation.** Home -> Reports -> a report; Developers -> MCP/API docs; footer legal links; mobile sheet opens/closes. Assert the `<main>` skip-link target and visible focus.
2. **Auth gating.** Signed-out visit to `/account` and `/admin` redirects to `/sign-in`; signed-out open of a free Snapshot redirects to `/sign-in` with `redirect_url` set.
3. **Entitlement gating.** As a free user, opening `/api/report/<date>/<slug>/pro.pdf` redirects to `/pricing`; as Pro, it 302s to a signed URL (assert the `Location` host is `*.r2.cloudflarestorage.com` and `Cache-Control: private, no-store`).
4. **Admin actions.** Grant/revoke Pro from MemberSearch; hide/restore an edition and confirm it leaves/returns to `/reports` and the sitemap; an audit-log row appears.
5. **Push flow (headline).** Grant notifications, enable push on `/account`, assert the `push_subscriptions` upsert (via a test API or DB probe), trigger `/api/cron/new-editions` with the `CRON_SECRET` bearer, and assert a notification is shown. This is the automated version of Phase D in `integration-tests.md`.
6. **Accessibility smoke.** Run `@axe-core/playwright` against the key pages in a real browser to catch contrast/visibility issues jsdom misses.

### Constraints to design around

- **Clerk sign-in** needs Clerk's test mode or test users; do not hard-code real credentials. Clerk publishes Playwright/testing helpers — see `../auth/` docs (owned elsewhere) before wiring.
- **Lemon Squeezy checkout** is an external top-level navigation (it is intentionally outside the CSP `form-action` allow-list as a redirect). E2E should stop at the checkout boundary or use Lemon Squeezy test mode, never drive a real payment.
- **No-auto-trading / live data.** E2E must use the preview environment (Neon `development` branch) and must never place a brokerage order — consistent with the project's hard no-auto-trading rule.
- **Push services are flaky in CI.** Real push delivery depends on an external push service; consider asserting the cron's JSON counters (`pushes`, `digests`) and the `showNotification` call rather than end-to-end OS delivery.

### Where it would live

- Specs under `web/tests/e2e/` (or a top-level `web/e2e/`), a `playwright.config.ts`, and a `"test:e2e": "playwright test"` script. Keep it out of the default `npm test` so the fast Vitest pass stays the pre-commit gate.

## Related docs

- `integration-tests.md` — the manual playbook this plan would automate (especially the push flow).
- `strategy.md` — why the suite is pure-logic-first today.
- `../deployment/vercel.md` — preview vs production environments E2E should target.
