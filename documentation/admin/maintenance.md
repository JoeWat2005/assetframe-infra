# Admin maintenance tasks

Routine curation an admin performs from `/admin` (all server-gated via `requireAdmin()` in `app/admin/actions.ts`, all audit-logged).

## Unpublish (hide) an edition

When a report is wrong or should not be public:

1. `/admin` -> **Editions** -> search the edition.
2. Toggle it to **Hidden** (`EditionToggle` -> `setEditionHidden(id, true)`).

Effect:
- The edition disappears from `/reports`, the report reader, and `sitemap.xml` (the catalog queries exclude hidden rows; the cron also skips them via `coalesce(hidden,false)=false`).
- It stays in the `editions` table (`hidden = true`) and **its files in R2 are untouched** — so it is fully restorable.
- An `unpublish_report` audit row is written and the content cache is busted (`revalidateTag("content")`).

The edition id must match `^\d{4}-\d{2}-\d{2}/[A-Za-z0-9_-]+$` (validated in the action).

## Restore a hidden edition

Toggle the same edition back to visible (`setEditionHidden(id, false)`) -> it returns to `/reports`/sitemap/reader; a `publish_report` audit row is written. No re-upload or re-sync needed because the files and DB row never left.

## Force-refresh the content cache

Catalog, track record, and admin stats are cached (`unstable_cache`, tag `content`, 120s revalidate for stats). If the site is serving stale data after a publish or a manual DB change:

- Run **revalidate** (`revalidateContent()` -> `revalidateTag("content")`). Logs a `revalidate` audit row. This clears the cache so the next request recomputes from the DB/catalog.

Use this when: you ran `sync-db` but the site still shows old numbers, or you hid/restored an edition out-of-band.

## Triage feedback

`/admin` -> **Feedback & feature requests**. Move each submission through its lifecycle with `setFeedbackStatus(id, status)`; valid statuses are `new`, `triaged`, `planned`, `done`, `declined` (whitelisted; id must be numeric).

## Manage member access

- **Grant Pro (comp):** `ProToggle` / `MemberSearch` -> `setPro(email, true)`. Sets `subscribed` in Clerk metadata; no charge; logs `grant_pro`.
- **Revoke Pro:**
  - Paying subscriber -> also cancels the Lemon Squeezy subscription (`cancelLemonSubscription`); access continues to period end (`subStatus -> cancelled`). Needs `LEMONSQUEEZY_API_KEY`; logs `revoke_pro` with the LS result.
  - Comp -> just clears the flag; logs `revoke_pro`.
- Refunds, bans, and Clerk role changes are done in the Clerk / Lemon Squeezy dashboards, not here.

## What maintenance must NOT touch

- **The outcome ledger** (`ledger/outcome_ledger.csv`) is append-only — corrections are appended by the engine, never edited from admin. See `../operations/scoring-workflow.md`.
- **R2 files** are not deleted by hiding an edition; deletion is a manual, deliberate R2 operation, not part of routine maintenance.

## Related docs

- `admin-panel.md`, `permissions.md`.
- `../operations/incident-response.md` (hide-an-edition as the fast content fix), `../deployment/rollback.md`, `../operations/publication-workflow.md`.
