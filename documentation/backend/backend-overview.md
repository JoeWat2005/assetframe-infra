# Backend overview

The web app's backend is entirely inside the Next.js project (`mvp/web/`): App Router **route handlers** (`app/api/**`), **server actions** (`"use server"` modules), and a **server-only data/service layer** (`lib/*.ts`). There is no separate backend service. Reminder: this is a modified Next.js (`web/AGENTS.md`); the request interceptor is `proxy.ts` (renamed `middleware`).

## Layers

1. **Route handlers** (`app/api/**`) — HTTP endpoints: the public REST API (`/api/v1/*`), the MCP server (`/api/mcp`), OAuth discovery (`/.well-known/*`), gated file serving (`/api/report/[...key]`), webhooks (`/api/webhooks/*`), the cron job (`/api/cron/new-editions`), newsletter confirm/unsubscribe, and the view beacon. See `api-routes.md`.
2. **Server actions** (`"use server"`) — mutations called from client components: `lib/social-actions.ts`, `lib/push-actions.ts`, `lib/checkout-actions.ts`, `app/admin/actions.ts`, `app/account/subscription/actions.ts`, and the feedback action. See `server-actions.md`.
3. **Service / data layer** (`import "server-only"`) — `content.ts` (editions + track record), `reports-api.ts` (JSON-safe payload builders for REST + MCP), `social.ts`, `feedback.ts`, `engagement.ts`, `admin-stats.ts`, `audit.ts`, plus integrations: `db.ts` (Neon), `r2.ts` (Cloudflare R2), `email.ts` (Resend), `push.ts` (web-push), `google-reviews.ts`, `lemonsqueezy.ts`, `clerk-webhook.ts`, `checkout-token.ts`, `cron.ts`, `access.ts`/`entitlements.ts`, `report-key.ts`.

## External dependencies

| Concern | Provider | Module / env |
|---|---|---|
| Auth & user metadata | Clerk | `@clerk/nextjs`, `proxy.ts`, `entitlements.ts`; `CLERK_*`, `ADMIN_EMAILS` |
| Database | Neon Postgres (serverless) | `lib/db.ts`; `DATABASE_URL` / `POSTGRES_URL` / `STORAGE_*` |
| Report files | Cloudflare R2 (S3 API) | `lib/r2.ts`; R2 creds |
| Billing | Lemon Squeezy (merchant of record) | `lib/lemonsqueezy.ts`, webhook; `LEMONSQUEEZY_*` |
| Email | Resend | `lib/email.ts`; `RESEND_API_KEY` |
| Web push | VAPID / web-push | `lib/push.ts`; `VAPID_*` |
| Reviews | Google Places API | `lib/google-reviews.ts`; `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID` |
| Cron auth | Vercel Cron | `lib/cron.ts`; `CRON_SECRET` |

## Data source pattern (DB-first, JSON fallback)

`content.ts` queries Neon when `sql` is non-null and **falls back to JSON files in `content/`** (`catalog.json`, `track-record.json`) on any error or when no DB is configured. Many service functions degrade gracefully (return `[]`/`null`/`false`) when their integration is unconfigured, so the app boots even with a partial environment.

## Access model

`lib/access.ts` `computeEntitlement(meta, email, adminEmails)` is the pure source of truth:
- `signedIn` from Clerk session.
- `billingActive` = `meta.subscribed === true` (set by the Lemon Squeezy webhook).
- `admin` = Clerk role `"admin"` OR email in `ADMIN_EMAILS`.
- `subscribed` (Pro access) = `billingActive || (admin && adminTier !== "free")`.

`lib/entitlements.ts` wraps it with `currentUser()`. The MCP server re-implements the same check via `clerkClient().users.getUser()`. See `../auth/` (owned elsewhere) and `middleware.md`.

## Free vs Pro boundary

- **Free** data (catalog, free Snapshot text + short-lived PDF link, public track record) flows over the REST API and MCP **with no auth**, and over the website to signed-in users.
- **Pro** data (full report bytes / text) is gated everywhere: website needs `subscribed`; `/api/report/.../pro.*` re-checks server-side; MCP `get_pro_report` needs OAuth + a live subscription. There is no public Pro path.

## Related docs

- `api-routes.md`, `server-actions.md`, `middleware.md`, `error-handling.md`.
- `../api/`, `../mcp/` — the public surfaces.
- `../database/`, `../storage/`, `../billing/`, `../auth/`, `../security/` — owned by other doc sets.
