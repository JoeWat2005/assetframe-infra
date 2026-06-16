# State & rendering (server vs client components)

The app is Next.js App Router. Most pages are **React Server Components (RSC)**; interactivity is pushed to small client islands. Reminder: this is a modified Next.js build (`web/AGENTS.md`) — `proxy.ts` is the renamed `middleware`.

## Rendering modes by route

| Mode | Where | Why |
|---|---|---|
| Static | `/about`, `/accessibility`, `/contact`, `/privacy`, `/terms`, `/faq`, `/how-it-works`, `/pricing`, `/developers*`, `/sign-in`, `/sign-up` | Pure content, no per-request data. |
| ISR (`revalidate`) | `/` (300s), `/reports` (300s), `/reviews` (86400s) | Catalog / reviews change rarely; background-revalidated. |
| `force-dynamic` | `/reports/{date}/{slug}`, `/track-record`, `/account`, `/account/subscription`, `/admin` | Read Clerk auth / entitlement per request. |

## Server components (no `"use client"`)

Render on the server, can be `async`, read data directly:
- **Pages** read `getCatalog`, `getTrackRecord`, `getEntitlement`, `getWatchlist`, `getAdminStats`, etc.
- **Layout primitives** `ui.tsx` (`Hero`, `Btn`, `Badge`, `Note`, `Section`), `Footer`, `AuthShell`, `ReportCard`, `Skeletons`, `HeroBackdrop`, `AuthBackdrop`.

Data layer (`lib/content.ts`, `lib/reports-api.ts`, `lib/social.ts`, etc.) is marked `import "server-only"` so it can never be bundled into the client.

## Client components (`"use client"`)

Interactive islands only:
- **Nav/shell:** `Header`, `HeaderAuth`, `AppFrame`, `Motion`, `ConsentAnalytics`.
- **Forms/actions:** `NewsletterForm`, `FeedbackForm`, `FollowButton`, `FollowingList`, `PushToggle`, `BuyButton`, `CancelSubscription`, `ResumeSubscription`, all `app/admin/*` toggles, `CodeBlock`.
- **Browsers/tables:** `ReportsBrowser`, `OpenCallsBrowser`, `ScoredResults`, `TrackRecordAnalytics` (Recharts is client-only).
- **Misc:** `ViewBeacon`, `Countdown`, `RedirectCountdown`, `error.tsx`.

State is local (`useState`/`useTransition`/`useEffect`); there is no global client store. Server data is passed down as props (e.g. `ReportsBrowser` receives the whole `Edition[]` and filters client-side).

## Caching

- `getCatalog`, `getTrackRecord`, `getTrending` are wrapped in `unstable_cache` (`revalidate: 300`, tag `content`). Even `force-dynamic` pages reuse the cached read instead of re-querying Neon.
- `getAdminStats` is cached 120s (tag `content`); `getGoogleReviews` 86400s (tag `reviews`).
- Admin actions and `revalidateContent()` call `revalidateTag("content")` to bust these after a publish/toggle.
- `getAllEditions` is intentionally **uncached** so the admin sees live state immediately after toggling.

## Hydration-safety patterns

- `Header.shown` and `Countdown.ms` start in a render-stable state (`false`/`null`) and are set on mount, avoiding server/client mismatch (the header never paints a stray bar; the countdown never renders a server time).
- `AppFrame`'s auth-page branch is the only pathname-dependent fork, keeping most SSR output static.
- `Motion` carries a watchdog timeout so GSAP failure never leaves `data-animate` elements invisible.

## Suspense / loading

`loading.tsx` files (reports, reader, track-record, account, admin) render the matching skeleton from `Skeletons.tsx` while the server component streams.

## Related docs

- `components.md` — per-component client/server classification.
- `ui-patterns.md` — accessibility + styling conventions.
- `../backend/backend-overview.md` — the server data layer.
