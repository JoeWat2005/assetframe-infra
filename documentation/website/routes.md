# Website Routes

Every page route in `mvp/web/app/`, with its access level and data source. Routes are App Router pages (`page.tsx`). API routes are documented in `../api/` and `../backend/api-routes.md`.

Access levels:
- **Public** — no auth check; renders for anyone.
- **Signed-in** — redirects to `/sign-in` unless a Clerk session exists.
- **Pro** — content gated on `getEntitlement().subscribed` (paid subscription OR admin comp). The page itself usually still renders for signed-out users but shows an upgrade prompt instead of the gated content.
- **Admin** — redirects unless `getEntitlement().admin`.

The middleware (`proxy.ts`) attaches Clerk auth context to every non-static route but does **not** itself gate any page — gating is done per page/route. See `../backend/middleware.md`.

## Marketing / content pages (public, mostly static)

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/` | `app/page.tsx` | `revalidate = 300` (ISR) | Public | `getCatalog()`, `getTrackRecord()` |
| `/about` | `app/about/page.tsx` | Static | Public | Static copy + `SITE` |
| `/accessibility` | `app/accessibility/page.tsx` | Static | Public | Static copy + `SITE` |
| `/contact` | `app/contact/page.tsx` | Static | Public | `SITE.socials`, `SITE.contactEmail` |
| `/privacy` | `app/privacy/page.tsx` | Static | Public | Static copy (hardcoded processor list) |
| `/terms` | `app/terms/page.tsx` | Static | Public | `SITE` |
| `/faq` | `app/faq/page.tsx` | Static | Public | Hardcoded FAQ array; emits FAQ JSON-LD |
| `/how-it-works` | `app/how-it-works/page.tsx` | Static | Public | Static copy |
| `/pricing` | `app/pricing/page.tsx` | Static | Public | `SITE.proPrice`, `FREE`/`PRO` feature arrays |
| `/reviews` | `app/reviews/page.tsx` | `revalidate = 86400` | Public | `getGoogleReviews()`; emits AggregateRating JSON-LD when reviews exist |
| `/feedback` | `app/feedback/page.tsx` | Static | Public (anonymous submit allowed) | `SITE.contactEmail`; renders `FeedbackForm` |

## Reports

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/reports` | `app/reports/page.tsx` | `revalidate = 300` | Public | `getCatalog()`, `getTrending()` |
| `/reports/{date}/{slug}` | `app/reports/[date]/[slug]/page.tsx` | `force-dynamic` (reads auth); `generateStaticParams` from catalog | Public teaser; **Snapshot needs sign-in**; **Pro report needs `subscribed`** | `getEdition()`, `getEntitlement()`, `isFollowing()` |

The reader page is the central gating example: a signed-out visitor sees the instrument header + bias + a "Create a free account" gate; a signed-in free user sees Snapshot links (`e.freeHtml`/`e.freePdf`) plus a Pro upsell; a `subscribed` user also sees Pro links pointing at `/api/report/{date}/{slug}/pro.html|pdf`. The file bytes themselves are gated again at the API layer (`../backend/api-routes.md`). See `reports-page.md`.

## Track record

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/track-record` | `app/track-record/page.tsx` | `force-dynamic` | Public headline; **full record needs `subscribed`** | `getEntitlement()`, `getTrackRecord()`, `getCatalog()` |

Signed-out / free users see four public headline stats (reports published, directional accuracy, 100% public archive, forecasts scored) and an upgrade prompt. Only `subscribed` users get `TrackRecordAnalytics`, `OpenCallsBrowser`, `ScoredResults` and the calibration table. See `track-record.md`.

## Developers

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/developers` | `app/developers/page.tsx` | Static | Public | `SITE`; exports `AgentGuidance` reused by the sub-pages |
| `/developers/mcp` | `app/developers/mcp/page.tsx` | Static | Public | `SITE` + hardcoded `TOOLS` reference |
| `/developers/api` | `app/developers/api/page.tsx` | Static | Public | `SITE` + hardcoded example payloads |

See `developers.md`.

## Account (signed-in)

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/account` | `app/account/page.tsx` | `force-dynamic` | **Signed-in** (`if (!ent.signedIn) redirect("/sign-in")`) | `getEntitlement()`, `getWatchlist(userId)` |
| `/account/subscription` | `app/account/subscription/page.tsx` | `force-dynamic` | **Signed-in** (`redirect("/sign-in")`) | `getEntitlement()`, `searchParams.welcome` |

See `account-admin.md`.

## Admin

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | `force-dynamic`; `robots: noindex` | **Admin** (`!signedIn → /sign-in`; `!admin → /account`) | `getAdminStats()`, `getAllEditions()`, `getAuditLog()`, `getFeedback()`, Clerk |

See `account-admin.md`.

## Auth (Clerk-hosted)

| Route | File | Rendering | Access | Data source |
|---|---|---|---|---|
| `/sign-in` (catch-all `[[...sign-in]]`) | `app/sign-in/[[...sign-in]]/page.tsx` | Static | Public | Clerk `<SignIn />` in `AuthShell` |
| `/sign-up` (catch-all `[[...sign-up]]`) | `app/sign-up/[[...sign-up]]/page.tsx` | Static | Public | Clerk `<SignUp />` in `AuthShell` |

The catch-all segment lets Clerk render its multi-step flows (verification, SSO callback) under the same path. `AppFrame` strips the site header/footer on these two paths.

## System / SEO routes (not pages)

| Route | File | Purpose |
|---|---|---|
| `/sitemap.xml` | `app/sitemap.ts` | 13 static routes + every edition (`/reports/{date}/{slug}`) |
| `/robots.txt` | `app/robots.ts` | Disallows `/admin`, `/account`, `/api/`, `/sign-in`, `/sign-up`; explicit allow rules for ~20 AI crawlers; declares sitemap + host |
| `not-found` | `app/not-found.tsx` | 404 page with `RedirectCountdown` to `/` |
| `error` | `app/error.tsx` | Client error boundary with "Try again" (`reset()`) |
| `loading` | `app/**/loading.tsx` | Suspense skeletons (reports, reader, track-record, account, admin) — see `../frontend/state-and-rendering.md` |

## Edge cases

- `generateStaticParams` in the reader page pre-renders one entry per catalog edition, but `force-dynamic` means each request re-reads auth so the gating is per-session.
- The home `Header` is hidden over the full-screen hero on `/` and reveals on scroll; every other route shows it at the top. See `navigation.md`.
- Hidden editions (`editions.hidden = true`) are excluded from `getCatalog()`/`getEdition()` (public 404) but visible in `/admin` via `getAllEditions()`.

## Related tests

- `tests/access.test.ts`, `tests/api-entitlement.test.ts` — entitlement derivation that drives page gating.
- `tests/a11y.test.tsx`, `tests/a11y-components.test.tsx` — accessibility of rendered pages/components.

## Related docs

- `navigation.md` — the four-category nav.
- `reports-page.md`, `track-record.md`, `pricing.md`, `developers.md`, `company-pages.md`, `account-admin.md`.
- `../backend/middleware.md` — Clerk proxy.
- `../api/overview.md`, `../mcp/overview.md` — programmatic access.
