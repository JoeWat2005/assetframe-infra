# Troubleshooting FAQ

Recurring operator questions. (This is the engineering/ops FAQ; the public product FAQ is the `/faq` page.)

### Why does a Pro download return 503 instead of the file?
R2 isn't configured for that environment. `signedReportUrl` returns null when the `R2_*` vars are unset, and the route returns a clean 503 rather than crashing. Set the R2 credentials (`../deployment/r2.md`).

### Why do my webhooks "do nothing" with no error?
Signature verification is **fail-closed and silent**: a wrong `LEMONSQUEEZY_WEBHOOK_SECRET` / `CLERK_WEBHOOK_SECRET` means events are rejected and access state simply doesn't change. There's no user-facing error — you'll see "stale access" reports instead. Align the secret with the provider dashboard.

### A user paid but has no Pro access. Where do I look?
The source of truth is Clerk `publicMetadata.subscribed` (set by the Lemon Squeezy webhook). If it's false, the webhook didn't apply — re-trigger from Lemon Squeezy, verify the webhook secret, and grant a comp from `/admin` as a stopgap. Confirm `subStatus` isn't `expired`/`unpaid`/`paused`.

### A cancelled customer still has Pro. Is that a bug?
No. Cancellation keeps access until the period end (`subStatus` becomes `cancelled`, which still grants), and dunning (`past_due`) also grants. Only `expired`/`unpaid`/`paused` revoke, and refunds/chargebacks revoke immediately (`../testing/security-tests.md`).

### The daily cron didn't notify anyone. Why?
Check the cron's JSON. `401` -> `CRON_SECRET` unset/mismatched. `{editions:0}` -> nothing dated today (publish + sync first). `pushes:0` -> VAPID unset or no `push_subscriptions` rows (email fallback should still fire if `RESEND_API_KEY` is set). See `../operations/incident-response.md`.

### Why did a subscriber NOT get the digest email?
By design, the cron emails only users it did **not** reach by push. If they enabled push, they got the push and were skipped for email. To verify the email path, disable push and re-run the cron.

### Can I just edit the ledger to fix a wrong score?
No — `ledger/outcome_ledger.csv` is **append-only**. The append-only invariant is even enforced by a test. Corrections are appended / handled via a manual verdict; re-fit calibration with `calibrate.py` (`../operations/scoring-workflow.md`).

### A report is wrong and live. Fastest fix?
Hide it from `/admin` -> Editions (sets `hidden=true`). It leaves `/reports`, the reader, and the sitemap immediately; the R2 files stay and it's restorable. Don't revert code for one report (`../admin/maintenance.md`).

### The track-record page shows wrong numbers.
That page reads the DB snapshot, not the CSV live. It's almost always a stale/bad `web/content/track-record.json`. Restore the good file and re-run `(cd web && npm run sync-db)`.

### Why is the admin dashboard only showing ~100 members in the charts?
The charts and recent-members list come from one newest-100 Clerk page (cheap, Clerk-independent for the rest). The **Members** KPI is the true `totalCount`; the "newest 100 in charts" note signals the cap (`../analytics/metrics.md`).

### Why does conversion never exceed 100%?
It's clamped on purpose, so a stale billing row (e.g. a deleted Clerk account) can't show an impossible figure.

### Why is there no cookie banner / no Google Analytics locally?
GA is undefined in dev by design (so localhost isn't tracked); it defaults to `G-QK5EM4V2LJ` only in production. The banner shows only when a GA id is configured and the visitor hasn't decided. Set `NEXT_PUBLIC_GA_ID` to test locally (`../analytics/tracking.md`).

### Something legitimate is being blocked in production. Is it the CSP?
Likely — the CSP in `next.config.ts` is enforced. As a fast, reversible mitigation, rename the header to `Content-Security-Policy-Report-Only`, redeploy, watch the violation reports, add the origin to the right directive, then restore the enforced key (`../deployment/rollback.md`).

### Preview deploy is emitting production URLs (canonical/sitemap). Why?
`SITE.url` resolves per environment from `VERCEL_ENV` + the `NEXT_PUBLIC_VERCEL_*` vars. If a preview shows prod URLs, check the env scope of `NEXT_PUBLIC_SITE_URL` (it should not be hard-set to prod in the Preview scope) (`../deployment/vercel.md`).

### `npm test` passes but the deploy fails to build. Why?
Vitest doesn't type-check; `next build` does. Run `npm run build` locally to catch the type error before pushing (`../operations/debugging.md`).

### A build aborts with `THESIS_BLOCKED` (or a free/Pro split / R:R error). What is that?
The engine's QA gate. `THESIS_BLOCKED` means a thesis claim isn't traced to a sourced fact in the research pack; the others mean structural violations (Pro vocab in the free Snapshot, bad risk:reward, banned language). The error names the violation; fix the payload (`../operations/publication-workflow.md`).

### `test_firewall.py` is failing. What did I break?
You referenced a marketing metric (`engagement`, `clicks`, `download_log`, etc.) inside a scoring module, or imported a scoring module from `web/lib/engagement.ts`. The two domains must stay separate so popularity never biases scoring. The output names the offending file + line (`../analytics/tracking.md`).

### Can the system place a trade if a report says "Buy"?
No. There is no order-placement path anywhere, and the no-auto-trading rule is absolute. "Buy/Sell/Wait" is a research label, not an order.

## Related docs

- `common-issues.md`, `error-reference.md`, `README.md`.
- `../operations/incident-response.md`, `../operations/debugging.md`, `../deployment/rollback.md`.
