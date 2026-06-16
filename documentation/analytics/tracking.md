# Tracking

The three client-side trackers, the consent gate, and the firewall that keeps marketing data out of scoring.

## Trackers (mounted in `app/layout.tsx`)

The root layout renders, in the `<body>`:

1. **`<Analytics />`** from `@vercel/analytics/next` — Vercel Web Analytics. Cookieless, privacy-friendly page-view/traffic analytics. No consent banner required.
2. **`<SpeedInsights />`** from `@vercel/speed-insights/next` — Core Web Vitals (LCP, CLS, INP, ...) in the Vercel Speed Insights dashboard. Cookieless.
3. **`<ConsentAnalytics />`** (`components/ConsentAnalytics.tsx`) — Google Analytics 4, **consent-gated** (see below).

## Google Analytics 4 (consent-gated)

`components/ConsentAnalytics.tsx`:

- **Measurement ID:** `process.env.NEXT_PUBLIC_GA_ID`, defaulting to **`G-QK5EM4V2LJ`** in production when unset, and `undefined` in dev (so localhost is never tracked). The ID is public — it ships in the page either way.
- GA (`<GoogleAnalytics>` from `@next/third-parties/google`) is loaded **only after** the visitor clicks **Accept**, because GA sets non-essential cookies that, under UK/EU rules, require prior consent.
- **Cookie banner:** shown only when a GA id is configured AND the visitor hasn't decided yet (`consent === null`). Offers **Reject** / **Accept**; the choice is persisted in `localStorage` under `af-cookie-consent` (`"granted"`/`"denied"`). The banner links to `/privacy`.
- If GA is not configured, there is nothing non-essential to consent to, so no banner renders (Clerk's auth cookies are strictly necessary).

### Admin dashboard links
`/admin` has outbound buttons to the Vercel Analytics/Speed dashboard (`SITE.analyticsUrl`) and the GA dashboard (`SITE.gaUrl`) — the raw analytics live in those external tools, not in the app.

## Server-side / DB engagement signals

Beyond the three browser trackers, the web layer records engagement to Postgres:

- **`download_log`** — gated Pro downloads (deduped per user/report/kind/hour). Feeds the admin "Pro downloads" KPI and "Top reports".
- **`report_views`** — report-view counts (marketing metric).
- **`social_engagement`** — social engagement (marketing metric); written via `web/lib/engagement.ts`.

## The firewall (marketing data must never reach scoring)

This is the critical tracking rule. The research scoring engine must **never** read marketing/engagement metrics, or a report's popularity could bias its confidence and corrupt the after-the-fact track record. Enforced by `scripts/test_firewall.py` (`../testing/security-tests.md`):

- Scoring modules (`confidence.py`, `calibrate.py`, `ledger_context.py`, `research_memory.py`, `score_report.py`, `scaffold_payload.py`) are scanned for the banned whole-words: `social_engagement`, `engagement`, `impressions`, `clicks`, `report_views`, `download_log`. Any occurrence fails the build.
- `web/lib/engagement.ts` (the recorder) is scanned to ensure it never imports a scoring module.

So `social_engagement` (and `report_views`, `download_log`) are **marketing-only / firewalled** — usable for growth analytics, never for scoring. This is why they do not appear in the confidence inputs or the ledger.

## Consent + privacy summary

| Tracker | Cookies? | Consent needed? | Gate |
| --- | --- | --- | --- |
| Vercel Analytics | No | No | always on |
| Vercel Speed Insights | No | No | always on |
| Google Analytics 4 | Yes (non-essential) | Yes | loads only after Accept |
| Clerk auth | Yes (strictly necessary) | No | always on |

## Adding a tracker

If you add any tracker that sets non-essential cookies, gate it behind the same consent state (do not load before `consent === "granted"`), and extend the CSP in `next.config.ts` to allow its script/connect origins (GA's `googletagmanager.com`/`google-analytics.com` and Vercel's `vercel-insights`/`vercel-scripts` are already allow-listed).

## Related docs

- `overview.md`, `metrics.md`.
- `../testing/security-tests.md` (the firewall test), `../seo/structured-data.md` (JSON-LD also in `layout.tsx`), `../deployment/environment-variables.md` (`NEXT_PUBLIC_GA_ID`).
