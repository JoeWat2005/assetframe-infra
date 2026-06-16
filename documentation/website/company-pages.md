# Company / content pages

The static informational pages, plus the dynamic Reviews and the Feedback form. All are server components unless noted; all are **public**.

## About — `/about`
`app/about/page.tsx`. Static. Static copy + `SITE`. Components: `Hero`, `Card`/`CardContent`.

## Accessibility — `/accessibility`
`app/accessibility/page.tsx`. Static. Documents the WCAG 2.2 AA commitment; uses a local `Clause` helper + `SITE.brand`/`SITE.contactEmail`.

## Contact — `/contact`
`app/contact/page.tsx`. Static. Renders `SITE.socials` + `SITE.contactEmail`. Components: `Hero`, `Card`, `Button`.

## Privacy — `/privacy`
`app/privacy/page.tsx`. Static. Hardcoded processor/sub-processor list (not DB-driven) + `SITE.contactEmail`. Local `Clause` helper.

## Terms — `/terms`
`app/terms/page.tsx`. Static. Uses `SITE.url`, `SITE.brand`, `SITE.contactEmail`, `SITE.proPrice`.

## FAQ — `/faq`
`app/faq/page.tsx`. Static. Hardcoded FAQ array rendered as collapsible `<details>` elements. **Emits FAQ schema JSON-LD** (`<script type="application/ld+json">`).

## How it works — `/how-it-works`
`app/how-it-works/page.tsx`. Static. Hardcoded pipeline steps ("published before the move, graded after"). Components: `Hero`, `Card`, `Button`.

## Reviews — `/reviews`
`app/reviews/page.tsx`. **`revalidate = 86400`** (24h). Public.
- **Data:** `await getGoogleReviews()` from `lib/google-reviews.ts` (Google Places API v1, cached 1 day, tag `reviews`).
- Emits **AggregateRating JSON-LD** only when `hasReviews && data.rating != null`.
- Falls back to a "Coming soon" state when reviews are unavailable or the integration is unconfigured (`GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID`).
- Local `Stars` helper renders rating.
- **NOT VERIFIED:** exact max number of reviews surfaced (the lib returns "up to ~5"; not confirmed against the page's slice).

## Feedback — `/feedback`
`app/feedback/page.tsx`. Static page shell, but the form accepts **anonymous public submissions**.
- Renders `FeedbackForm` (`app/feedback/FeedbackForm.tsx`, client component).
- The form calls the `submitFeedback()` server action; has a honeypot field (`name="company"`, hidden) for bot filtering; resets on success; shows a pending state.
- Submissions land in the `feedback` DB table and surface in `/admin` via the `FeedbackInbox`. See `account-admin.md` and `../backend/server-actions.md`.
- **NOT VERIFIED:** `submitFeedback` is referenced by the form; its exact signature/guard lives in a feedback actions module not read in full (the read `lib/feedback.ts` only exposes `getFeedback`). Treat the write path as "anonymous-allowed, honeypot-guarded, writes `feedback` table" pending confirmation.

## Common patterns

- Every page sets `metadata` with a `canonical` alternate; titles use the root layout template `%s — AssetFrame`.
- The standing `SITE.disclaimer` appears on most pages.
- These pages perform no auth checks and read no per-user data (except Reviews, which reads a cached external API).

## Related docs

- `routes.md` — the full route table.
- `account-admin.md` — where feedback is triaged.
- `../backend/error-handling.md` — `not-found.tsx` / `error.tsx`.
