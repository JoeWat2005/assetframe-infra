# Reports pages

Two routes: the catalog browser (`/reports`) and the individual report reader (`/reports/{date}/{slug}`).

## `/reports` — catalog browser

- **File:** `app/reports/page.tsx` (server component, `revalidate = 300`).
- **Access:** Public.
- **Data:** `Promise.all([getCatalog(), getTrending()])` from `lib/content.ts`.
- **Key components:** `Hero`, `ReportsBrowser` (client), `ReportCard`.

Behaviour:
- Renders a "Popular this week" rail (top 3 `getTrending()` editions) **only when** `trending.length >= 3 && editions.length > trending.length` — a meaningful popular subset, not just every report echoed back.
- The main list is `ReportsBrowser`, a client component with search + six dropdown filters (category/asset class, direction, confidence, risk, date, sort) and "Show more" pagination (12 per page). All filtering is client-side over the full catalog.
- Empty state: "No editions published yet."

`getTrending()` reads the `report_views` table (most-viewed editions over the last 7 days). View counts are written by the `ViewBeacon` -> `/api/report-view` path. Returns `[]` (rail hidden) when the DB/table isn't present.

## `/reports/{date}/{slug}` — reader

- **File:** `app/reports/[date]/[slug]/page.tsx` (server component, `export const dynamic = "force-dynamic"` because it reads auth).
- **`generateStaticParams`:** one entry per `getCatalog()` edition.
- **`generateMetadata`:** `"{instrument} — {reportDate}"`.
- **Data:** `getEdition(date, slug)`, `getEntitlement()`, `auth()` (for `userId`), `isFollowing(userId, slug)`.
- **Key components:** `FollowButton`, `Badge`, `Btn`, `BuyButton`, `Note`, `ViewBeacon`.

### Access tiers (per-section gating)

1. **Not found:** `if (!e) notFound()` -> 404. Hidden editions are absent from `getEdition`, so they 404 publicly.
2. **Signed-out:** sees the instrument header, ticker/asset class, status/risk badges, bias, edition + window dates, catalyst status, and a `FollowButton` (links to sign-in). The report body is replaced by a "Create a free account to read this report" gate with sign-up / sign-in CTAs (carrying `redirect_url` back to the report).
3. **Signed-in (free):** sees the **Free Snapshot** card with `ReportLinks` pointing directly at `e.freeHtml` / `e.freePdf`, plus a **Pro report** card with a `BuyButton` ("Subscribe to unlock") and a link to `/pricing`.
4. **`subscribed` (Pro or admin-comp):** the Pro card shows `ReportLinks` to `/api/report/{date}/{slug}/pro.html` and `/.../pro.pdf`.

### How file links resolve

`e.freeHtml` / `e.freePdf` are R2 object keys passed through the `Btn ... external` component. They (and the Pro `/api/report/...` paths) ultimately route through the gated `/api/report/[...key]` handler, which re-checks entitlement server-side and 302-redirects to a short-lived signed R2 URL. So even though a signed-in free user can see the Free Snapshot links, the bytes are still gated (free.* needs sign-in, pro.* needs subscription). See `../backend/api-routes.md` and `../api/auth.md`.

### Other behaviour

- `ViewBeacon` (client) fires a one-time `POST /api/report-view` per session to increment the trending counter.
- Emits Article JSON-LD (`headline`, `datePublished`, `author`/`publisher` = AssetFrame org, `about` = instrument, optional `image` from `e.preview` when it's an absolute URL).
- A copyright + Terms notice and the `SITE.disclaimer` render at the bottom.

## Edge cases

- `confidence` is joined from the open call (`LEFT JOIN open_calls`) and may be `null`; the page shows status/risk/bias regardless.
- `catalystStatus` only renders if present (`{e.catalystStatus && ...}`) — never fabricated.
- The `back` redirect param is `encodeURIComponent`-wrapped so the post-auth bounce returns to the exact edition.

## Related components

`ReportCard.tsx`, `ReportsBrowser.tsx`, `ViewBeacon.tsx`, `FollowButton.tsx`, `BuyButton.tsx` — see `../frontend/components.md`.

## Related docs

- `../backend/api-routes.md` — `/api/report/[...key]` byte-serving + entitlement re-check.
- `../api/endpoints.md` — the same Snapshot data over REST.
- `track-record.md`, `pricing.md`.
