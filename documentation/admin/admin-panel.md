# Admin panel

The admin dashboard lives at **`/admin`** (`app/admin/page.tsx`). It is server-rendered (`force-dynamic`), `noindex` (`robots: { index:false }`), and gated server-side: not signed in -> `/sign-in`; signed in but not admin -> `/account`. See `permissions.md` for who qualifies.

All data is loaded server-side in one `Promise.all`: admin stats (`getAdminStats`), the full edition catalog (`getAllEditions`), the audit log (`getAuditLog`), and feedback (`getFeedback`).

## KPI row

Six cards (`lib/admin-stats.ts` + page math):

| KPI | Source |
| --- | --- |
| **Members** | Clerk `totalCount` (newest 100 feed the charts; "newest 100 in charts" note if capped) |
| **Pro subscribers** | `billing_subscriptions` count where status in `active`/`on_trial`/`cancelled`/`past_due` |
| **Conversion** | `subscribers / members`, clamped to <=100% |
| **Editions** | `catalog.length` |
| **Pro downloads** | `download_log` total |
| **Est. MRR** | `subscribers * price`, price parsed from `SITE.proPrice` |

Members come from Clerk; subscribers + downloads from the DB — so each renders independently if the other source is down. See `../analytics/metrics.md`.

## Preview tier toggle

`AdminTierToggle` (-> `setMyAdminTier`). Admins are comped Pro; switching to **Free** lets an admin see exactly what a non-subscriber sees, without losing admin access (drives `adminTier` in Clerk metadata; a real paid sub overrides it). See `permissions.md`.

## Charts

`components/admin/Charts` (Recharts): New members (30-day sign-ups), Pro downloads (30-day), Free vs Pro split donut, Editions by asset class.

## Top reports + Recent members

- **Top reports by downloads** — `download_log` grouped, top 8, mapped to instrument titles via the catalog.
- **Recent members** — newest ~12 Clerk accounts, each with an inline `ProToggle` to grant/revoke Pro.

## Manage access

`AdminActions` + below it:
- **Find a member** (`MemberSearch` -> `searchMembers`): query Clerk by email/name, up to 20 results, each with an inline Pro toggle.
- **`ProToggle`** (-> `setPro`): grant a comp, or revoke. Revoking a **paying** subscriber also cancels their Lemon Squeezy subscription (billing stops; access continues to period end). Revoking a comp just clears the flag.

## Activity log

`AdminLog` over `getAuditLog()` (most recent 200, client-filterable). Records admin + billing actions: `grant_pro`, `revoke_pro`, `admin_tier`, `unpublish_report`/`publish_report`, `revalidate`, `feedback_status`, etc. — actor, action, target, detail, UTC timestamp. Append-only via `logAudit` (best-effort; never blocks the action). See `../security/` (owned elsewhere) for the audit model.

## Feedback inbox

`FeedbackInbox` over `getFeedback()` — public-form submissions, triaged by changing status through `new -> triaged -> planned -> done -> declined` (`setFeedbackStatus`, status whitelisted).

## Traffic & performance

Two outbound buttons to external dashboards: Vercel (Analytics & Speed Insights) at `SITE.analyticsUrl`, and Google Analytics at `SITE.gaUrl`. Visitor/Core-Web-Vitals data lives there, not in the app. See `../analytics/tracking.md`.

## Editions browser

`EditionsBrowser` over the full catalog. Search an edition and toggle it **Hidden** to unpublish it from the public site, sitemap, and reader (`EditionToggle` -> `setEditionHidden`). Files in R2 are untouched and it can be restored. See `maintenance.md`.

## What is NOT in the admin panel

Refunds, bans, and Clerk role assignment are intentionally out of scope — they live in the **Clerk** and **Lemon Squeezy** dashboards (stated in the page's footer note). The admin panel reads/grants entitlement and curates editions/feedback; it is not a full billing console.

## Related docs

- `permissions.md`, `maintenance.md`.
- `../analytics/metrics.md` (KPI definitions), `../analytics/overview.md`.
- `../billing/`, `../auth/` (owned elsewhere).
