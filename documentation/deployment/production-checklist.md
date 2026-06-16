# Production launch checklist

A go-live gate for AssetFrame, grounded in the actual env/config surface and `LAUNCH_AUDIT.md`. Tick each item before pointing `www.assetframe.co.uk` at the Production deployment.

## 1. Vercel project

- [ ] Root Directory set to the folder with `package.json` (the `web` app). See `vercel.md`.
- [ ] `main` -> Production, `development` -> Preview. Production domain `www.assetframe.co.uk` assigned; apex/`www` redirect configured.
- [ ] Build succeeds: `npm run build` locally with prod-like env, and the Production deploy is green.
- [ ] `poweredByHeader: false` and the security headers in `next.config.ts` are live (verify HSTS, `X-Content-Type-Options`, `X-Frame-Options`, CSP on a prod response).

## 2. Environment variables (Production scope)

Set in Vercel -> Project -> Environment Variables (Production). Cross-check against `environment-variables.md`.

Auth + billing:
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_*`, `CLERK_SECRET_KEY` = `sk_live_*` (domain-locked Clerk prod instance).
- [ ] `CLERK_WEBHOOK_SECRET` set; Clerk webhook endpoint -> `/api/webhooks/clerk` configured.
- [ ] `LEMONSQUEEZY_WEBHOOK_SECRET` set; LS webhook -> `/api/webhooks/lemonsqueezy` configured. `LEMONSQUEEZY_API_KEY` set (enables in-app cancel). `LEMONSQUEEZY_VARIANT_IDS` set if you want to restrict which variants grant Pro.
- [ ] `CHECKOUT_TOKEN_SECRET` set (or accept the `CLERK_SECRET_KEY` fallback).
- [ ] `ADMIN_EMAILS` set to the real admin address(es).
- [ ] `NEXT_PUBLIC_CHECKOUT_URL` / `NEXT_PUBLIC_PRO_PRICE` match the live Lemon Squeezy variant.

Data + storage:
- [ ] `DATABASE_URL` -> Neon `main` (pooled). `DATABASE_URL_DEV` -> Neon `development` if previews need data.
- [ ] Migrations applied on `main`: `npm run migrate:up` (and on `development`). Then `npm run sync-db` to load editions.
- [ ] `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET=assetframe-pro` set; a Pro file fetches via signed URL.

Cron + notifications (the items most often missed — none are in `.env.example`):
- [ ] `CRON_SECRET` set. Without it the daily cron 401s silently (fail-closed). Verify with the curl in `../testing/integration-tests.md`.
- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` set (the public key duplicated). Generate via `npx web-push generate-vapid-keys`. Until set, push is off and alerts go by email only.
- [ ] `RESEND_API_KEY` set and `RESEND_FROM` is a verified sender (not the shared `onboarding@resend.dev`, which only mails the account owner).
- [ ] `GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID` set if `/reviews` should show live Google reviews.

Analytics:
- [ ] `NEXT_PUBLIC_GA_ID` — defaults to `G-QK5EM4V2LJ` in prod; override only if using a different property. Confirm the consent banner appears and GA loads only after Accept (`../analytics/tracking.md`).

## 3. Tests

- [ ] `npx vitest run` green (from `web/`).
- [ ] Python engine green: each `python scripts/test_*.py`, and `python scripts/test_firewall.py` prints `FIREWALL OK`.

## 4. Functional smoke (Production)

- [ ] Signed-out: catalog visible, free Snapshot -> `/sign-in`, `/admin` + `/account` -> `/sign-in`.
- [ ] Free account: opens a Snapshot; Pro file -> `/pricing`.
- [ ] Pro account: Pro PDF renders via signed URL.
- [ ] Admin: `/admin` renders KPIs; "Preview tier" toggle works; member search + Pro grant/revoke work; an audit-log row lands.
- [ ] Checkout: buy flow reaches Lemon Squeezy; on completion the LS webhook flips `subscribed` and the user gets Pro.
- [ ] Push flow end-to-end per `../testing/integration-tests.md` Phase D (enable on `/account`, publish a today-dated edition, trigger the cron, expect a notification + email fallback).

## 5. SEO + crawlability

- [ ] `/sitemap.xml` and `/robots.txt` return the production host (driven by `site.config.ts`). `/admin`, `/account`, `/api/`, `/sign-in`, `/sign-up` are disallowed.
- [ ] `/llms.txt` reachable; JSON-LD (Organization/WebSite/SoftwareApplication/Dataset) renders in `<head>` (`app/layout.tsx`). See `../seo/`.
- [ ] `/admin` and `/account` carry `robots: noindex`.

## 6. Accessibility

- [ ] vitest-axe suite green; manual keyboard pass on Header/mobile sheet/forms; skip link works (`../accessibility/`).

## 7. Compliance / content

- [ ] Disclaimer present on reports and emails (`SITE.disclaimer`). No page contradicts another on pricing/Pro benefits/confidence wording (`LAUNCH_AUDIT.md` site-consistency).
- [ ] No-auto-trading guarantee intact — there is no order-placement path anywhere.

## Known follow-ups (from project memory / `LAUNCH_AUDIT.md`)

- Rotate the live Clerk secret; add Preview test keys.
- Ensure the Neon `development` branch exists and is migrated.
- Add `VAPID_*`, `RESEND_*`, `GOOGLE_*`, `CRON_SECRET` to `.env.example` so they are not forgotten (they ship in code but not in the example file).

## Related docs

- `environment-variables.md`, `vercel.md`, `neon.md`, `r2.md`, `rollback.md`.
- `../testing/integration-tests.md` (smoke + push playbook), `../operations/daily-operations.md`.
