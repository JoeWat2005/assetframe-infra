# Error handling

How the backend and route layer handle failures. The theme is **graceful degradation**: non-critical subsystems return empty/neutral results instead of throwing, so a partial environment (no DB, no R2, no email) still serves the app.

## Route-level responses

| Situation | Response |
|---|---|
| Invalid report ref (REST detail) | `isValidReportRef` fails -> `404 { error: "not_found", message }` (same shape as a real miss). |
| Invalid report key (file serve) | `classifyReportKey` returns null -> `400 "Bad request"`. |
| Unauthorized file tier | `free.*` not signed in -> 302 `/sign-in?redirect_url=...`; `pro.*` not subscribed -> 302 `/pricing`. |
| R2 unconfigured | `signedReportUrl` null -> `503 "Report storage is not configured yet."` |
| Bad webhook signature | `401 "Invalid signature"`. |
| Unparseable webhook body | `400 "Bad payload"` / `"Bad request"`. |
| Webhook DB failure | `500 "Update failed"` / `"Cleanup failed"`. |
| Cron without secret | `401 "Unauthorized"`; no DB -> `{ ok: false, reason: "no-db" }`. |
| View beacon any error | swallowed -> always `204`. |

## Page-level error boundaries

- **`app/not-found.tsx`** — the 404 page. Title "This page is off the tape."; includes `RedirectCountdown` (5s to `/`), "Back home"/"Browse reports" CTAs and quick-nav cards. Reached via `notFound()` (e.g. the report reader when an edition is missing/hidden) or unmatched routes.
- **`app/error.tsx`** — a client error boundary (`{ error, reset }`). Logs the digest/message to console (no PII), shows "Something went wrong" with a "Try again" button (`reset()`) and a "Back home" link.
- **`loading.tsx`** files render skeletons during Suspense (not errors, but the same resilience family).

## Service-layer degradation

- **`lib/content.ts`** — DB-first with try/catch around every query, falling back to `content/*.json`; the track-record queries even retry with a reduced projection when newer taxonomy columns are absent (`pred_type`, `verdict`, `asset_class_key`, ...). `getTrending` returns `[]` if the `report_views` table is missing.
- **`lib/db.ts`** — `sql` is `null` when no connection string is set; every consumer checks `if (sql)` first.
- **`lib/r2.ts`** — returns `null` when R2 is unconfigured or an object is missing.
- **`lib/email.ts`** — `{ ok: false, skipped: true }` when Resend is unconfigured; `{ ok: false, error }` on API failure (never throws into the caller).
- **`lib/push.ts`** — `{ ok: false, skipped: true }` when VAPID unset; `{ ok: false, expired: true }` on 404/410 (the cron prunes those endpoints).
- **`lib/google-reviews.ts`** — `null` when unconfigured or on API error -> `/reviews` shows "Coming soon".
- **`lib/audit.ts logAudit`** — best-effort; catches all errors silently so a logging failure never breaks the action it records.
- **Download logging** in `/api/report` — wrapped in try/catch; a failure never blocks the download.

## Server-action errors

Server actions generally return `{ ok: false, message }` rather than throwing, so the calling client island can render an inline error. The exception is the admin `requireAdmin()` guard, which throws `"Not authorized"` (the page already redirected non-admins, so this is defence in depth).

## Webhook resilience

- Clerk `user.deleted`: the subscription mapping is deleted **only after** a successful cancel; failed cancels are logged and the mapping retained, so a deleted user is never silently left billable.
- Lemon Squeezy: unresolved grants/revokes are logged (`grant_unresolved` / `revoke_unresolved`) instead of failing, so they are observable and recoverable; stale events are skipped idempotently.

## Related docs

- `api-routes.md` — per-route status codes.
- `backend-overview.md` — the degradation philosophy.
- `../security/` (owned elsewhere) — signature verification + abuse limits.
