# Common issues

Symptom -> cause -> fix. Each row is grounded in how the relevant module actually behaves. The recurring theme: AssetFrame **degrades gracefully** when an integration is unconfigured, so a "missing feature" is usually a missing env var.

## Downloads / reports

| Symptom | Cause | Fix |
| --- | --- | --- |
| Opening a Pro/free file returns **503** "Report storage is not configured yet." | R2 env unset (`signedReportUrl` returns null) | Set `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` (`../deployment/r2.md`) |
| Pro/free file returns **400** "Bad request" | Object key failed the allow-list (wrong shape or traversal attempt) | Verify the URL is `/<date>/<slug>/(free|pro).(html|pdf)`; not a bug if the input was malformed (`../testing/security-tests.md`) |
| Free Snapshot redirects to `/sign-in` | Free tier requires an account (by design) | Sign in; this is correct gating |
| Pro file redirects to `/pricing` | Signed-in but not subscribed | Subscribe, or grant a comp from `/admin` |
| A published report doesn't appear on `/reports` | Not synced, or hidden | Run `(cd web && npm run sync-db)`; check it isn't toggled Hidden in `/admin` |

## Notifications (push + email)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/account` shows "Push notifications aren't configured yet" | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` unset | Set all four VAPID vars (`../deployment/environment-variables.md`) |
| Cron only ever sends email, never push | VAPID **server** keys unset (`pushConfigured` false) | Set `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` |
| No emails sent at all | `RESEND_API_KEY` unset (`sendEmail` -> `{skipped:true}`) | Set `RESEND_API_KEY` |
| Emails only reach the operator | Using shared `onboarding@resend.dev` sender | Verify your domain in Resend and set `RESEND_FROM` |
| Push enabled but no notification on cron run | No today-dated edition, or no `push_subscriptions` row | Publish/sync an edition dated today; re-enable push; re-run cron |
| A user gets BOTH push and email | They shouldn't — email is fallback-only | Confirm the user's `push_subscriptions` row has their `clerk_user_id`; the cron skips emailing users it reached by push |
| "Push enabled" but browser shows nothing | Permission blocked or browser unsupported | PushToggle shows "blocked"/"unsupported"; check site notification permission; push needs HTTPS (or localhost) |

## Cron

| Symptom | Cause | Fix |
| --- | --- | --- |
| Cron returns **401 Unauthorized** | `CRON_SECRET` unset (fail-closed) or token mismatch | Set `CRON_SECRET` in Production; Vercel Cron sends `Bearer $CRON_SECRET` |
| Cron returns `{ok:false, reason:"no-db"}` | DB unset | Set `DATABASE_URL` (`../deployment/neon.md`) |
| Cron returns `{ok:true, editions:0}` | Nothing dated today (or all hidden) | Publish + sync an edition dated today |
| Manual curl 401s with a token | Missing `Bearer ` prefix or wrong length | Use exactly `-H "Authorization: Bearer $CRON_SECRET"` (`../testing/integration-tests.md`) |

## Admin dashboard

| Symptom | Cause | Fix |
| --- | --- | --- |
| Members shows a number but Pro subscribers/downloads are 0 | DB unset or `billing_subscriptions`/`download_log` not migrated | Set DB; run `npm run migrate:up` (`../deployment/neon.md`) |
| Charts/recent members only cover ~100 people | By design — newest 100 Clerk page feeds charts (`membersCapped`) | Expected; the Members KPI is still the true total |
| Member search / Pro grant fails | Clerk not configured / wrong keys | Check `CLERK_SECRET_KEY` |
| Conversion shows a sane % even with a stale billing row | Clamped to <=100% on purpose | Expected (`../analytics/metrics.md`) |
| `/admin` redirects me to `/account` | You're signed in but not admin | Add your email to `ADMIN_EMAILS` or set Clerk `role=admin` (`../admin/permissions.md`) |

## Auth / billing

| Symptom | Cause | Fix |
| --- | --- | --- |
| Paid user has no Pro access | LS webhook didn't set `subscribed` in Clerk metadata | Re-trigger from Lemon Squeezy; verify `LEMONSQUEEZY_WEBHOOK_SECRET` matches; grant a comp meanwhile |
| Webhooks "do nothing" (no error) | Wrong webhook secret -> signature rejected (fail-closed, silent) | Align `LEMONSQUEEZY_WEBHOOK_SECRET` / `CLERK_WEBHOOK_SECRET` with the dashboards |
| Cancelled user lost access immediately | Shouldn't — cancel keeps access to period end | Check `subStatus`; `cancelled`/`past_due` still grant (`../testing/security-tests.md`) |
| **Non-subscriber can open Pro (critical)** | Possible auth regression | Instant-rollback; re-run `tests/api-entitlement.test.ts` + `tests/sec-report-key.test.ts`; audit `lib/access.ts`/`report-key.ts`/the report route |

## Build / deploy

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm run build` fails on types | Type error (Vitest doesn't type-check; the build does) | Fix the type before pushing (`../operations/debugging.md`) |
| A legitimate resource is blocked in prod | Enforced CSP in `next.config.ts` | Temporarily flip to `Content-Security-Policy-Report-Only`, redeploy, diagnose, restore (`../deployment/rollback.md`) |
| Preview emits production URLs (or vice-versa) | `SITE.url` resolution / env scope | Confirm `VERCEL_ENV` + `NEXT_PUBLIC_SITE_URL` per environment (`../deployment/vercel.md`) |
| Vercel Toolbar / Pusher blocked on preview | Only allowed when `VERCEL_ENV==="preview"` | Expected; the allowance is preview-scoped by design |

## Engine (Python)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build aborts with `THESIS_BLOCKED` | A thesis claim isn't traced to the research pack | Source the claim or drop it from the thesis (`test_scaffold_payload.py`) |
| Build aborts: free/Pro split / R:R lint / banned language | QA gate caught a violation | The message names the violation; fix the payload |
| `test_firewall.py` fails | A scoring module referenced a marketing metric, or `engagement.ts` imported a scoring module | Remove the cross-reference (`../analytics/tracking.md`) |
| Nested report directory / broken R2 keys | Wrong `out_dir` | Must be exactly `reports/<date>/<slug>` (`../operations/publication-workflow.md`) |
| Track-record numbers wrong on the site | Stale `web/content/track-record.json` | Restore the good file, re-run `sync-db`; never edit the ledger (`../operations/scoring-workflow.md`) |

## Analytics

| Symptom | Cause | Fix |
| --- | --- | --- |
| No cookie banner / no GA in dev | `NEXT_PUBLIC_GA_ID` undefined in dev by design (defaults only in prod) | Expected; set `NEXT_PUBLIC_GA_ID` to test locally (`../analytics/tracking.md`) |
| GA not loading in prod even after Accept | ID missing/wrong or consent denied | Prod defaults to `G-QK5EM4V2LJ`; confirm the visitor accepted |

## Related docs

- `error-reference.md`, `faq.md`.
- `../operations/debugging.md`, `../operations/incident-response.md`, `../deployment/rollback.md`, `../deployment/environment-variables.md`.
