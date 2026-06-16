# Rollback

How to revert AssetFrame safely. There are two independent things that can go wrong — **the deployed code** and **the published content/data** — and they roll back differently.

## 1. Roll back the deployment (code/config)

Vercel keeps every prior deployment immutable. The fastest, safest recovery is **Instant Rollback / Promote**:

1. Vercel -> Project -> Deployments.
2. Find the last known-good Production deployment.
3. Use **Promote to Production** (a.k.a. Instant Rollback) to make it the active production deployment. No rebuild — it re-points the alias.

Git alternative (triggers a rebuild): `git revert <bad-commit>` on `main` and push, or reset `main` to the good commit and force-push (use with care; prefer `revert`). Per the project rule, branch first if you are not already on the working branch, and avoid destructive history rewrites unless necessary.

> Env-var changes are **not** captured by a deployment rollback in a way you can read back — Vercel secrets are write-only. If a bad env value caused the incident, fix the value in Project Settings and redeploy; promoting an old build will NOT restore old secret values.

## 2. CSP / header rollback

The Content-Security-Policy in `next.config.ts` is enforced. If a legitimate resource is being blocked in production and you need to unblock fast without a full investigation, the source documents the escape hatch: rename the header key from `Content-Security-Policy` to `Content-Security-Policy-Report-Only`. That reports violations without blocking. Re-deploy, diagnose, then restore the enforced key. (The `vercel.live`/Pusher allowances are already scoped to Preview only, so they are not a production concern.)

## 3. Unpublish a bad edition (content, no deploy)

If a single report is wrong, do **not** revert code. Hide it:

- `/admin` -> Editions -> search the edition -> toggle **Hidden**. This sets `editions.hidden = true` and the edition vanishes from `/reports`, the reader, and the sitemap. The R2 files are untouched and it can be restored by toggling back. See `../admin/maintenance.md`.
- This is server-gated (`setEditionHidden` in `app/admin/actions.ts`, `requireAdmin()`), writes an audit row, and busts the content cache (`revalidateTag("content")`).

## 4. Roll back published data (catalog / track record)

`sync-db.mjs` upserts editions and **replaces** the track-record snapshot from `web/content/catalog.json` and `web/content/track-record.json`. To roll the public data back to a previous state:

1. `git checkout <good-commit> -- web/content/catalog.json web/content/track-record.json` (or restore the prior files).
2. `(cd web && npm run sync-db)` — re-applies the older snapshot to **both** Neon branches.
3. Commit the reverted content files and push so the deployed app and the DB agree.

Notes:
- `sync-db.mjs` is idempotent and re-runnable; re-syncing the correct content is the normal repair.
- Editions are upserted (not deleted) by id, so re-syncing an older catalog will not remove rows added later — if you need to remove an edition, hide it (step 3) rather than relying on sync.

## 5. What you must NOT roll back

- **The outcome ledger (`ledger/outcome_ledger.csv`) is append-only.** Never edit, reorder, or delete rows to "undo" a score. If a score was wrong, the correction is a new appended row / a manual verdict, per `../operations/scoring-workflow.md`. This is a hard project rule.
- **Migrations:** `npm run migrate:down` rolls back the last migration on the branch its connection string names. Only do this if a migration itself is the problem, and run it per branch — it does not fan out like `sync-db.mjs`.

## 6. Webhook / billing incidents

- A bad webhook deploy cannot grant access on its own — signatures are verified (`../testing/security-tests.md`). If entitlement state is wrong for a user, fix it from `/admin` (grant/revoke Pro) or in the Clerk + Lemon Squeezy dashboards, which are the source of truth; the audit log records the change.

## Decision guide

| Symptom | Action |
| --- | --- |
| New deploy broke the site | Promote last good deployment (instant rollback) |
| One report is wrong | Hide the edition from `/admin` |
| Track-record numbers wrong | Restore `web/content/*.json`, re-run `sync-db` |
| A legit resource is CSP-blocked | Flip CSP to Report-Only, redeploy, diagnose |
| Wrong env value | Fix in Vercel settings + redeploy (rollback won't restore secrets) |
| A score is wrong | Append a correction; never edit the ledger |

## Related docs

- `vercel.md`, `neon.md`, `r2.md`.
- `../admin/maintenance.md`, `../operations/incident-response.md`, `../operations/scoring-workflow.md`, `../operations/publication-workflow.md`.
