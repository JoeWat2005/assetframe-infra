# Frontend components

Inventory of `components/**`. "Client" = has `"use client"`; otherwise it's a React Server Component (RSC). For server-vs-client rationale see `state-and-rendering.md`.

## Layout & shell

| Component | Type | Purpose |
|---|---|---|
| `AppFrame` | client | Layout router. Strips header/footer on `/sign-in` & `/sign-up` (via `usePathname`); renders a skip-to-content link, a main region (id `main-content`, tabIndex -1, `pt-14`), and the passed-in header/footer nodes. |
| `Header` | client | The four-category nav. See `navigation.md`. |
| `HeaderAuth` | client | Clerk-aware auth controls (`useUser`/`useClerk`). Loading placeholder; signed-in renders Account link + `UserButton` (desktop) or plain Account/Sign-out links (mobile, avoids popover focus-trap); signed-out renders Sign in. |
| `Footer` | server | Logo, tagline, social grid (from `SITE.socials`), link grid, embedded `NewsletterForm`, disclaimer, copyright. |
| `AuthShell` | server | Two-column auth layout: navy panel + `AuthBackdrop` (decorative ticker) on the left, the Clerk form on the right; single column on mobile. |
| `Motion` | client | GSAP scroll-reveal (`data-animate="up"`) + hero load-in (`data-animate="hero"`); MutationObserver for late mounts; 1800ms watchdog so content never strands invisible; respects reduced-motion. |
| `ui.tsx` | server | Layout primitives: `Badge`, `Btn`, `Section`, `Note`, `Hero` (not shadcn). `Btn` with `external` adds a screen-reader "opens in new tab" hint (WCAG G201). |

## Reports & track record

| Component | Type | Purpose / data |
|---|---|---|
| `ReportCard` | server | Single edition card; props `{ e: Edition; animate?: boolean }`. Preview image, status/risk badges, confidence + data-quality, Pro lock icon, link to `/reports/{date}/{slug}`. No file links. WCAG-AA badge contrast. |
| `ReportsBrowser` | client | Search + 6 filters (category, direction, confidence, risk, date, sort) + "Show more" (12/page) over `Edition[]`. All client-side; renders `ReportCard`s. |
| `OpenCallsBrowser` | client | Props `{ open: OpenCall[]; assetClass?: Record<string,string> }`. Search + 3 filters; expandable rows showing per-prediction verdict badges (Y/N/NT/MANUAL); "Show more" (15/page). `aria-expanded`/`aria-controls`. |
| `ScoredResults` | client | Props `{ rows: ScoredRow[] }`. Sort dropdown + paginated table (25/page); hit-rate badge green at or above 50%, red below. |
| `TrackRecordAnalytics` | client | Recharts charts (hit rate over time, by asset class / pred type / regime, calibration curve, component-vs-outcome, by-instrument table). Each section renders only if its prop array is non-empty. |

## Auth, billing & engagement

| Component | Type | Purpose / calls |
|---|---|---|
| `BuyButton` | client | Branches: subscribed to `/account/subscription`; admin to `/account`; signed-out to `/sign-up?redirect_url=%2Fpricing`; signed-in free calls `getCheckoutUrl()` then sets `window.location.href`. |
| `CancelSubscription` | client | AlertDialog confirm; invokes the `onCancel` prop (a server action passed from the page). |
| `ResumeSubscription` | client | Button; invokes the `onResume` prop. |
| `FollowButton` | client | Props `{ symbol, instrument, initialFollowing, signedIn, signInHref }`. Optimistic follow toggle via `toggleFollow()` (`lib/social-actions`); `aria-pressed`. Signed-out gives a sign-in link. |
| `FollowingList` | client (`app/account/`) | Renders the watchlist; unfollow via `toggleFollow()`, optimistic removal. |
| `PushToggle` | client | Web-push enable/disable. States: loading / unsupported / blocked / enabled / disabled. Registers `/sw.js`; calls `saveSubscription()` / `removeSubscription()` (`lib/push-actions`). Disabled when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset. |
| `NewsletterForm` | client | Email form; honeypot `company` field; calls `subscribeNewsletter(FormData)` (`lib/social-actions`); double-opt-in messaging. |
| `ViewBeacon` | client | Props `{ id }`. Posts once per session to `/api/report-view` (sessionStorage dedupe, `keepalive`); renders null. |
| `ConsentAnalytics` | client | GDPR cookie banner; loads Google Analytics only when consent granted (`localStorage` key `af-cookie-consent`) and `NEXT_PUBLIC_GA_ID` set. |
| `Countdown` | client | Countdown to next publish (`SITE.publish`); null until mount to avoid hydration mismatch; reduced-motion aware. |

## Decorative / misc

| Component | Type | Purpose |
|---|---|---|
| `HeroBackdrop` | server | Deterministic SVG candlestick + SMA backdrop (SSR-safe). |
| `AuthBackdrop` | server | Deterministic vertical ticker-tape backdrop. |
| `RedirectCountdown` | client | 404 auto-redirect with GSAP progress bar + "Go now". |
| `Skeletons` | server | Suspense skeletons (Hero/Stats/Rows/Page/Article/Reports/TrackRecord/Account). |

## `components/ui/` (shadcn/ui + Radix)

`button`, `card`, `input`, `select`, `badge`, `skeleton`, `separator`, `avatar`, `dropdown-menu`, `alert-dialog`, `navigation-menu`, `sheet`, `chart` (Recharts wrappers), `textarea`. These are the styled primitives the app components compose.

## Edge cases

- `ReportCard`'s `animate` prop is set `false` in interactive lists so reused cards don't strand hidden when filters change.
- `HeaderAuth` mobile uses plain links instead of Clerk's `UserButton` popover to dodge a focus-trap bug.
- `BuyButton` shows an `adminBlocked` state if the server reports the viewer is an admin.

## Related docs

- `state-and-rendering.md`, `forms.md`, `ui-patterns.md`, `navigation.md`.
- `../backend/server-actions.md` — the actions these components call.
