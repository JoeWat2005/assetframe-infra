# Daily operations

The day-to-day rhythm of running AssetFrame. The system has two moving parts: the **engine** (local Python that scores yesterday and generates today's editions) and the **web app** (auto-deployed on Vercel, with one daily cron).

## The daily cycle

```
~before 06:00 London   Generate editions for today via the /mvp skill.
                       This FIRST scores yesterday's expired windows
                       (score_report.py -> calibrate.py), then builds reports.
                       -> HUMAN REVIEW is mandatory before publishing.
publish                export_content.py -> publish.py (R2) -> sync-db (Neon, both branches)
                       -> commit web/content/*.json -> push (Vercel redeploy)
06:00 London           SITE.publish says editions publish at 06:00 UK (LSE opens 08:00).
07:00 UTC              Vercel Cron hits /api/cron/new-editions -> web push + email digest
                       to subscribers and per-instrument alerts to followers.
```

See `publication-workflow.md` for the full publish pipeline and `scoring-workflow.md` for the score-then-calibrate step.

## The one scheduled job

`/api/cron/new-editions`, scheduled `0 7 * * *` (07:00 UTC daily) in `web/vercel.json`:

- Selects editions where `report_date = CURRENT_DATE` and not hidden.
- If web push is configured (`pushConfigured`), sends a digest push to `digest`-topic subscriptions and per-instrument pushes to followers (the `watchlists` join), pruning dead endpoints (404/410).
- Then emails (Resend) as a **fallback** — only to confirmed subscribers / followers it did NOT already reach by push. With push unconfigured, it emails everyone (the original behaviour).
- Returns `{ ok, editions, pushes, digests, alerts }`. Auth is the fail-closed `CRON_SECRET` bearer.

To run it by hand (e.g. after a late publish), use the curl in `../testing/integration-tests.md`.

## Daily health checks

1. **Cron ran.** Vercel -> Project -> Logs (or the Cron tab) for the 07:00 UTC invocation. A 401 means `CRON_SECRET` is missing/mismatched in Production.
2. **Editions are live.** `/reports` shows today's editions; `/api/v1/reports` returns them; `preview.png` thumbnails load.
3. **Track record updated.** `/track-record` reflects any windows scored this morning.
4. **Notifications fired.** The cron JSON shows `pushes`/`digests`/`alerts` > 0 when there were editions and recipients. Spot-check that an email actually arrived (Resend dashboard).
5. **No error spike.** Vercel runtime logs; admin "Activity log" for unexpected admin/billing actions.

## Weekly / periodic

- Review `/admin` KPIs (members, Pro subscribers, conversion, downloads, MRR) — see `../analytics/metrics.md`.
- Triage the feedback inbox on `/admin` (new -> triaged -> planned -> done/declined).
- Check the Lemon Squeezy + Clerk dashboards for refunds/chargebacks/disputes (these flow through the LS webhook and revoke access automatically, but verify).
- Confirm the calibration map is healthy once the ledger crosses ~10+ scored rows (`calibrate.py`), since confidence is only meaningfully calibrated past that point.

## Things that should never happen in daily ops

- Publishing an edition without human review (the QA gate aborts builds, but the visual stamp is a human step).
- Editing the append-only `ledger/outcome_ledger.csv`.
- Placing any brokerage order — there is no execution path; the system is decision-support only.

## Related docs

- `publication-workflow.md`, `scoring-workflow.md`, `incident-response.md`, `debugging.md`.
- `../deployment/vercel.md` (cron), `../analytics/metrics.md` (KPIs), `../admin/admin-panel.md`.
