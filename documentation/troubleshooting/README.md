# Troubleshooting

A symptom-first index for when AssetFrame misbehaves. Most failures are **a missing environment variable**, not a bug — every external integration degrades gracefully when unconfigured (see `common-issues.md`).

## Start here

1. **What broke?** Code (a deploy), content (one report), data (track record/catalog), an integration (Clerk/LS/R2/Neon/Resend/push), or the cron? See the decision table in `../deployment/rollback.md`.
2. **Is it just unconfigured?** Check `common-issues.md` — a 503 download, a missing cookie banner, "push not configured", or zeroed subscriber counts are usually env, not error.
3. **Need to revert?** `../deployment/rollback.md`. **Active incident?** `../operations/incident-response.md`. **Diagnosing locally?** `../operations/debugging.md`.

## Docs in this section

- `common-issues.md` — symptom -> cause -> fix table, grounded in the graceful-degradation behaviour of each module.
- `error-reference.md` — what specific HTTP statuses and JSON responses mean (503, 400, 401 cron, `{ok:false,reason:...}`).
- `faq.md` — recurring "why is X happening" questions for operators.

## Cross-references (don't duplicate — go to source)

| Topic | Doc |
| --- | --- |
| Revert a deploy / content / data | `../deployment/rollback.md` |
| Incident severity + playbooks | `../operations/incident-response.md` |
| Local debugging + degradation map | `../operations/debugging.md` |
| Every env var + purpose | `../deployment/environment-variables.md` |
| Cron not firing / no notifications | `../operations/incident-response.md`, `../operations/daily-operations.md` |
| Wrong KPI numbers | `../analytics/metrics.md` |
| Test a fix | `../testing/strategy.md` |

## Golden rules during any fix

- **Never place a brokerage order** — there is no execution path; do not add one.
- **Never edit `ledger/outcome_ledger.csv`** — it is append-only; corrections are appended (`../operations/scoring-workflow.md`).
- **Never permanently weaken auth/CSP** to clear an issue — use the documented temporary escape hatch (CSP Report-Only) and restore.
