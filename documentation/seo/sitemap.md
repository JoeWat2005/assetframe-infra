# Sitemap

`app/sitemap.ts` generates `/sitemap.xml` dynamically (Next.js `MetadataRoute.Sitemap`). It combines a fixed list of public routes with one entry per published edition pulled from the catalog.

## Static routes (with crawl hints)

Each route carries a `changeFrequency` and `priority` tiered by how often it changes and how important it is:

| Route | changeFrequency | priority |
| --- | --- | --- |
| `/` | daily | 1.0 |
| `/reports` | daily | 0.9 |
| `/track-record` | daily | 0.9 |
| `/pricing` | weekly | 0.8 |
| `/how-it-works` | weekly | 0.7 |
| `/developers`, `/developers/mcp`, `/developers/api` | weekly | 0.7 |
| `/faq` | weekly | 0.6 |
| `/reviews` | weekly | 0.6 |
| `/about` | monthly | 0.5 |
| `/contact` | monthly | 0.4 |
| `/feedback` | monthly | 0.4 |
| `/accessibility`, `/terms`, `/privacy` | monthly | 0.3 |

`lastModified` is set to "now" for static routes.

## Edition entries

For every edition in `getCatalog()`:

- **URL:** `${base}/reports/${e.date}/${e.slug}` (e.g. `/reports/2026-06-16/BTC`).
- **lastModified:** the edition's `reportDate` if present, else now.
- **changeFrequency:** `daily`; **priority:** `0.8`.

The catalog comes from the DB (synced by `sync-db.mjs`). **Hidden editions are excluded** — the catalog source filters them, so unpublishing an edition removes it from the sitemap (see `../admin/maintenance.md`). If the DB is unavailable at build/render, the `try/catch` falls back to just the static routes (no crash).

## Notably absent

Private/auth routes (`/admin`, `/account`, `/sign-in`, `/sign-up`) are **intentionally not** in the sitemap — `app/robots.ts` also disallows them. The raw `/api/*` endpoints are not listed (agents use `llms.txt`/OpenAPI/MCP instead).

## Host correctness

`base = SITE.url.replace(/\/$/, "")` — the sitemap is emitted on the correct per-environment host (production domain in prod, the deployment URL in preview). This keeps preview sitemaps from advertising production URLs.

## Verifying

- Fetch `/sitemap.xml` on the target environment; confirm the host is right, the static routes are present, and today's editions appear (after publish + sync).
- The robots file points crawlers to it: `sitemap: ${base}/sitemap.xml` (`app/robots.ts`).

## Related docs

- `overview.md`, `robots-and-llms-txt.md`, `metadata.md`.
- `../deployment/neon.md` (catalog source), `../admin/maintenance.md` (hidden editions leave the sitemap).
