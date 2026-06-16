# Structured data (JSON-LD)

AssetFrame emits schema.org JSON-LD so search engines and AI engines recognise the entity, the site, the product (with its MCP/REST access points), the public track-record dataset, individual editions, the FAQ, breadcrumbs, and reviews. All blocks are injected as `<script type="application/ld+json">`.

## Sitewide graph (`app/layout.tsx`, `orgJsonLd`)

A single `@graph` rendered on every page, with cross-referenced `@id`s:

### Organization (`#organization`)
`name`, `url`, `logo` (`/logo.png`), `email` (`SITE.contactEmail`), description (research, scored after the fact, **not** regulated advice), `sameAs` (the non-empty `SITE.socials`), and a `ContactPoint` (customer support, English).

### WebSite (`#website`)
`name`, `url`, `inLanguage: en-GB`, `publisher` -> `#organization`, and a `SearchAction` `potentialAction` whose `urlTemplate` is `${SITE.url}/reports?q={search_term_string}` (sitelinks search box).

### SoftwareApplication (`#software`)
The product itself: `applicationCategory: FinanceApplication`, `applicationSubCategory: "Market research and decision support"`, `operatingSystem: "Web, MCP, REST API"`, a description that states predictions are graded Hit/Miss/No-trigger in an append-only ledger and that **confidence is calibrated, not a guarantee or signal**. `isAccessibleForFree: true`. `featureList` (Snapshot, Pro report, public ledger, MCP server, REST API). Two `offers`: Snapshot (price `0`, GBP) and Pro (price `9.99`, GBP, `category: subscription`, url `/pricing`). A `ConsumeAction` `potentialAction` pointing at `${SITE.url}/api/mcp` — telling agents the research is consumable over MCP.

### Dataset (`#track-record`)
The public track record as a citable dataset: `name`, `url` (`/track-record`), description (append-only, graded after the fact, rows never edited), `license: ${SITE.url}/terms`, `isAccessibleForFree: true`, `creator`/`publisher` -> `#organization`, and a `DataDownload` distribution with `encodingFormat: application/json` and `contentUrl: ${SITE.url}/api/v1/track-record`.

## Per-page JSON-LD

### Article — report reader (`app/reports/[date]/[slug]/page.tsx`)
Each edition emits an `Article`: `headline` (`"<instrument> — next-session market research (<reportDate>)"`), `datePublished`/`dateModified` = `reportDate`, `url` + `mainEntityOfPage` = the edition URL, `author` = Organization (`SITE.brand`), `publisher` -> `#organization`, `about` = the instrument, and `image` only when the preview is an absolute URL. Lets an edition earn a rich result.

### FAQPage — `/faq` (`app/faq/page.tsx`)
A `FAQPage` whose `mainEntity` maps the on-page FAQ list to `Question` + `acceptedAnswer`/`Answer` using the plain-text answer (`f.text`, kept separate from the JSX answer so the structured data is clean text).

### Review / AggregateRating — `/reviews` (`app/reviews/page.tsx`)
When Google reviews are available, the page attaches `aggregateRating` (value, `reviewCount`, best/worst 1-5) and a `review` array (`Review` with `author` Person, `reviewRating` Rating, `reviewBody`) onto the Organization `@id`. Rendered only when review data is present (guarded), so no empty/fake review markup.

### BreadcrumbList — reusable helper (`app/layout.tsx`, `BreadcrumbJsonLd`)
An exported component: drop `<BreadcrumbJsonLd items={[{name,path},...]} />` into any nested page (e.g. `/developers/mcp`, a report). It prepends "Home", builds 1-based `ListItem` positions, and resolves absolute `item` URLs from `SITE.url`. NOT VERIFIED which specific pages currently render it (the helper exists and is intended for the developer/report sub-pages).

## Why these types

- **SoftwareApplication + Dataset** are the AI-answer-engine plays: they tell an assistant exactly what AssetFrame is, that it's free-to-access with a paid tier, and that the research + track record are reachable over MCP and a JSON REST API — reinforcing `llms.txt`.
- **Article / FAQPage / Review** target classic rich results (article, FAQ accordion, star ratings).
- The graph uses stable `@id`s (`#organization`, `#website`, `#software`, `#track-record`) so the Article `publisher`, the reviews `aggregateRating`, and breadcrumbs all reference one canonical Organization node.

## Consistency notes

- Every description in the structured data repeats the **not-advice** framing and the **calibrated-confidence** semantics — keep these aligned with `SITE.disclaimer`, `llms.txt`, and the public pages (site-consistency rule).
- All URLs derive from `SITE.url`, so the markup is correct per environment (prod vs preview).

## Validating

- Use Google's Rich Results Test / Schema Markup Validator on `/`, a report URL, `/faq`, and `/reviews`.
- Confirm only one Organization node resolves (via shared `@id`) and that offers/prices match `SITE.proPrice` and the Lemon Squeezy variant.

## Related docs

- `overview.md`, `metadata.md`, `robots-and-llms-txt.md`.
- `../analytics/tracking.md` (shares `app/layout.tsx`), `../mcp/`, `../api/` (the surfaces the SoftwareApplication/Dataset reference — owned elsewhere).
