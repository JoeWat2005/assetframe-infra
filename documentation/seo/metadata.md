# Metadata

Page metadata uses the Next.js Metadata API. The sitewide defaults live in `app/layout.tsx`; pages override `title`/`description` and add their own breadcrumbs/structured data.

## Sitewide defaults (`app/layout.tsx` `export const metadata`)

- **Title template:** default `"${SITE.brand} — ${SITE.tagline}"`; per-page template `"%s — ${SITE.brand}"` (so a page exporting `title: "Admin"` renders `"Admin — AssetFrame"`).
- **Description:** the product one-liner ("Pre-session market research and decision support: a free Snapshot and a full Pro report for each instrument, with every call scored against the tape afterwards. Not personal advice.").
- **`metadataBase`:** `new URL(SITE.url)` — so all relative OG/canonical URLs resolve to the correct per-environment absolute host.
- **`alternates.canonical`:** `"/"` at the root (pages set their own as needed).
- **`applicationName`:** `AssetFrame`.
- **OpenGraph:** `type: website`, `siteName`, `url: SITE.url`, `locale: en_GB`, title/description from `SITE`.
- **Twitter:** `card: summary_large_image`, `site`/`creator: @AssetFrame`.
- **Robots:** `index:true, follow:true`, with `googleBot` hints `max-image-preview: large`, `max-snippet: -1`, `max-video-preview: -1`.

## Shared OG/social image

The repo ships `app/opengraph-image.png` (and `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`). Next.js auto-wires `opengraph-image.png` as the default OG/Twitter image and the icon files as favicons/app icons via file-based metadata conventions. (Twitter `card: summary_large_image` pairs with this.)

## Per-page metadata

Pages export their own `metadata` (or `generateMetadata`) to set a specific title/description and, where private, to opt out of indexing:

- `/admin` -> `{ title: "Admin", robots: { index:false, follow:false } }`.
- `/account` -> `{ title: "Account" }` (gated, also disallowed in robots.ts).
- Public pages (reports, track record, pricing, developers, etc.) set descriptive titles; the title template appends "— AssetFrame".

NOT VERIFIED here: the exact per-page `description`/canonical strings for every public page (only the layout defaults and the admin/account overrides were read in this doc set's scope). The report-detail and other dynamic pages likely use `generateMetadata` to set instrument-specific titles — confirm in each page file.

## Canonicalisation

`metadataBase` + per-page `alternates.canonical` produce canonical URLs on the correct host per environment. Because `SITE.url` is environment-resolved, a preview deploy emits its own `*.vercel.app` canonical (not the production domain), avoiding duplicate-content signals between preview and prod.

## Language / locale

`<html lang="en">` (`app/layout.tsx`); OpenGraph `locale: en_GB`; WebSite JSON-LD `inLanguage: en-GB`. AssetFrame is a UK product (GBP pricing, FCA-language disclaimer).

## Related docs

- `overview.md`, `sitemap.md`, `structured-data.md`.
- `../deployment/vercel.md` (how `SITE.url` resolves per environment).
