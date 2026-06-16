# Metrics

The KPIs on `/admin` come from `lib/admin-stats.ts` (`getAdminStats`, cached 120s, tag `content`) plus a little arithmetic in `app/admin/page.tsx`. Each metric, its exact source, and its caveats:

## KPI cards

### Members
- **Source:** Clerk. One page of the newest 100 accounts ordered by `-created_at`; `members = page.totalCount` (falls back to `page.data.length` if Clerk omits the count).
- **Caveat:** the count is the true total, but the **charts and recent-members list cover only the newest 100** (`membersCapped` -> "newest 100 in charts" note). If Clerk rejects the `orderBy` param, it retries unordered rather than zeroing the dashboard.

### Pro subscribers
- **Source:** the `billing_subscriptions` table: `count(*)` where `status IN ('active','on_trial','cancelled','past_due')`.
- **Why those statuses:** all four still grant access (active, trialing, cancelling-but-paid-through, dunning). **Admin comps are excluded** (they never paid) — correct for a subscriber/MRR metric.
- **Resilience:** comes straight from the DB, so it is accurate and works even if Clerk is down. Empty if the billing table is not migrated yet.

### Conversion
- **Computed** in the page: `subscribers / members`, as a percentage to 1 dp, **clamped to <=100%** so a stale billing row (e.g. a deleted Clerk account) can never show an impossible >100%.

### Editions
- **Source:** `catalog.length` (the full edition catalog from `getAllEditions`).

### Pro downloads
- **Source:** `download_log` total `count(*)`.
- **What's logged:** gated Pro file fetches via `app/api/report/[...key]/route.ts`, **deduped per (user, report, kind) per hour** so a logged-in caller cannot inflate the number by hammering the route. Public preview fetches are NOT logged.

### Est. MRR
- **Computed:** `subscribers * price`, where price is parsed from `SITE.proPrice` (e.g. `£9.99/month` -> 9.99). It is an estimate (flat price x active-ish subs), not billed revenue — Lemon Squeezy is the source of truth for actual revenue.

## Charts (30-day, `lib/admin-stats.ts`)

- **New members:** sign-ups per day over the last 30 UTC days, derived from the newest-100 Clerk page (so only sign-ups within that window/page appear).
- **Pro downloads:** `download_log` grouped by UTC day over the last 30 days.
- **Free vs Pro split:** donut of `subscribers` vs `max(0, members - subscribers)` (labelled "newest 100" when capped).
- **Editions by asset class:** counts from the catalog (`assetClass`, default "Other").

## Tables

- **Top reports by downloads:** `download_log` grouped by `report_id`, top 8, mapped to instrument titles via the catalog.
- **Recent members:** newest ~12 Clerk accounts with their `subscribed` flag.

## Marketing-only metrics (NOT shown as KPIs, firewalled)

- **`report_views`** and **`social_engagement`** are engagement tables for marketing analysis. They are deliberately **walled off from the scoring engine** (`../analytics/tracking.md`, `../testing/security-tests.md`) and are not part of the confidence/track-record math. NOT VERIFIED whether `report_views`/`social_engagement` are currently rendered anywhere in the admin UI — `getAdminStats` does not read them; they exist as tables and are populated by the web layer.

## Reliability principle

Members come from Clerk; subscribers, downloads, and editions come from the DB/catalog. Each block is wrapped so a failure in one source (Clerk down, a table not migrated) degrades only that block — the rest of the dashboard still renders. This is the same graceful-degradation pattern as the rest of the app.

## Related docs

- `overview.md`, `tracking.md`.
- `../admin/admin-panel.md` (where these render), `../deployment/neon.md` (the tables), `../analytics/overview.md` (the firewall).
