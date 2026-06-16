# Incident response

A triage guide for production incidents. Pair with `rollback` (`../deployment/rollback.md`) for the actual revert mechanics and `debugging.md` for diagnosis.

## First moves (any incident)

1. **Scope it.** Is it the *code* (a bad deploy), the *content* (one wrong report), the *data* (track record / catalog), an *integration* (Clerk/LS/R2/Neon/Resend/push), or the *cron*?
2. **Stop the bleeding** before you diagnose:
   - Bad deploy -> Vercel instant rollback (promote last good deployment).
   - One bad report -> hide it from `/admin` (no deploy).
   - Wrong access for a user -> grant/revoke from `/admin` or the Clerk/LS dashboards.
3. **Check logs:** Vercel runtime logs, the cron invocation log, and the admin "Activity log" (`admin_audit_log`) for what changed and who changed it.

## Severity guide

| Severity | Examples | Response |
| --- | --- | --- |
| Critical | Site down; Pro content leaking to non-subscribers; signups/payments broken | Instant rollback; verify entitlement gating; page the operator |
| High | Cron not firing; emails/pushes not sending; a report shows wrong numbers | Fix env/secret or hide the edition; re-run cron by hand |
| Medium | One integration degraded (e.g. Resend down) but app still serves | Note it; the app degrades gracefully; fix at leisure |
| Low | Cosmetic, analytics, a single stale KPI | Backlog / cache bust |

## Playbooks

### Site is down / erroring after a deploy
Promote the last good Production deployment (`../deployment/rollback.md`). If a CSP change is blocking a legitimate resource, flip the header to `Content-Security-Policy-Report-Only`, redeploy, diagnose, restore.

### A report is wrong (numbers, claim, or it should never have shipped)
Hide it: `/admin` -> Editions -> toggle **Hidden**. It leaves `/reports`, the reader, and the sitemap immediately; R2 files stay; it is restorable. Do not revert code for a single report. Then investigate the generation (the QA gate should have caught structural errors — if it did not, that is a separate engine bug).

### Track-record numbers look wrong
Most likely a stale or bad `web/content/track-record.json`. Restore the good file and re-run `(cd web && npm run sync-db)` to repopulate Neon on both branches. **Never** edit `ledger/outcome_ledger.csv` to "fix" it — corrections are appended (`scoring-workflow.md`).

### Cron didn't run / no notifications
- 401 in the cron log -> `CRON_SECRET` missing or mismatched in Production. Set it, re-run with the curl in `../testing/integration-tests.md`.
- `editions: 0` -> nothing is dated today (publish/sync first, or the editions are hidden).
- `pushes: 0` but subscribers exist -> VAPID env missing (`pushConfigured` false) or no `push_subscriptions` rows; email fallback should still fire. Check `RESEND_API_KEY`/`RESEND_FROM`.
- Notifications arriving but no email to a non-push user -> verify the subscriber is `confirmed` and on the `digest` topic.

### Pro content not accessible to a paying user
- Check the user's Clerk `publicMetadata.subscribed` and `subStatus`. The LS webhook sets these; if it failed, re-trigger from Lemon Squeezy or grant a comp from `/admin` while you investigate.
- Check `LEMONSQUEEZY_WEBHOOK_SECRET` matches the LS dashboard (a mismatch makes every webhook fail verification, silently leaving access unchanged).

### Pro content accessible to a NON-subscriber (critical)
- This should be impossible: the report route checks `ent.subscribed` server-side and the key allow-list blocks traversal. Treat as critical: instant-rollback to a known-good build, verify `tests/api-entitlement.test.ts` + `tests/sec-report-key.test.ts` pass on that build, and audit recent changes to `lib/access.ts`, `lib/entitlements.ts`, `lib/report-key.ts`, or `app/api/report/[...key]/route.ts`.

### R2 / downloads returning 503
R2 unconfigured or credentials wrong. Verify `R2_*` in Production (`../deployment/r2.md`). 503 is the deliberate "storage not configured" response, not a crash.

### Database unavailable
`lib/db.ts` `sql` is null -> DB-backed features (catalog from DB, downloads, billing count, feedback, push) degrade; static pages still render. Check the Neon connection string and Neon status. The cron returns `{ ok:false, reason:"no-db" }`.

### Webhook signature failures
Confirm the relevant secret (`LEMONSQUEEZY_WEBHOOK_SECRET` / `CLERK_WEBHOOK_SECRET`) matches the provider dashboard. Verification is timing-safe and fail-closed — a mismatch means events are rejected and access state silently does not change, so users will report stale access rather than a crash.

## Hard rules during any incident

- **Never place a brokerage order.** There is no execution path; do not add one under pressure.
- **Never edit the append-only ledger.**
- **Never weaken auth/CSP permanently** to clear an incident — use the documented temporary escape hatches (CSP Report-Only) and restore.

## Post-incident

- Add an audit note (admin action) and, if a regression slipped through, a test mirroring it (the suite is the regression net — see `../testing/strategy.md`).
- If an env var was the cause, add it to `../deployment/production-checklist.md` so it is checked next time.

## Related docs

- `../deployment/rollback.md`, `debugging.md`, `daily-operations.md`, `scoring-workflow.md`.
- `../admin/maintenance.md`, `../testing/integration-tests.md` (cron curl).
