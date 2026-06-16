# Analytics overview

AssetFrame measures itself in two strictly separated places, and the separation is a load-bearing design rule, not an accident.

## Two domains, one firewall

1. **Product / marketing analytics** — who visits, who converts, what gets downloaded, web vitals. Lives in Vercel Analytics, Vercel Speed Insights, Google Analytics 4, and a handful of Postgres tables (`download_log`, `report_views`, `social_engagement`). Surfaced to the operator on `/admin` and in the external dashboards.
2. **Research scoring** — the confidence engine and the append-only track record. Lives entirely in the Python engine and the `ledger/`.

These two **must never cross**. Popularity/engagement signals (views, downloads, likes) are forbidden inputs to scoring, because letting a report's popularity influence its confidence or its grade would corrupt the track record. This is enforced by `scripts/test_firewall.py` (see `../testing/security-tests.md`): the scoring modules are scanned for banned marketing terms, and `web/lib/engagement.ts` is scanned to ensure it never imports a scoring module. Hence `social_engagement` and the other engagement tables are **marketing-only / firewalled**.

## What is collected where

| Signal | Mechanism | Surfaced on |
| --- | --- | --- |
| Page views, traffic | Vercel Analytics (`@vercel/analytics`) | Vercel dashboard |
| Core Web Vitals | Vercel Speed Insights (`@vercel/speed-insights`) | Vercel dashboard |
| Behavioural analytics | GA4 (`G-QK5EM4V2LJ`), consent-gated | Google Analytics |
| Members, sign-ups | Clerk (`totalCount`, newest 100) | `/admin` |
| Pro subscribers, MRR | `billing_subscriptions` table | `/admin` |
| Pro downloads | `download_log` table | `/admin` |
| Report views | `report_views` table | (marketing metric; firewalled) |
| Social engagement | `social_engagement` table | (marketing metric; firewalled) |

## Consent

GA4 sets non-essential cookies, so under UK/EU rules it loads **only after the visitor accepts** the cookie banner (`components/ConsentAnalytics.tsx`). Vercel Analytics/Speed Insights are cookieless and run without a banner. Clerk's auth cookies are strictly necessary and need no consent. See `tracking.md`.

## Privacy posture

- The banner offers Accept / Reject; the choice is stored in `localStorage` (`af-cookie-consent`). Reject -> GA never loads.
- `/privacy` is linked from the banner.
- The admin KPIs are aggregate counts; member emails appear only in the admin-gated member lists.

## Related docs

- `metrics.md` — exact KPI definitions and their data sources.
- `tracking.md` — the three trackers, the consent gate, and the firewall.
- `../testing/security-tests.md` — the firewall test.
- `../admin/admin-panel.md` — where the KPIs render.
