# Error reference

What AssetFrame's specific responses mean. Many "errors" are deliberate, fail-safe responses, not crashes — this table tells you which.

## HTTP statuses

### `503` — report route (`app/api/report/[...key]/route.ts`)
"Report storage is not configured yet." Returned when R2 is unconfigured (`signedReportUrl` -> null). **Deliberate**, not a crash. Fix: set the `R2_*` env vars (`../deployment/r2.md`).

### `400` — report route
"Bad request." The object key failed `classifyReportKey` — wrong shape, wrong extension, traversal attempt, bad date, over-long slug. **Working as intended** if the input was malformed (the allow-list is a security control, `../testing/security-tests.md`). Only a bug if a *legitimate* key is rejected — then check the key matches `<date>/<slug>/(free|pro).(html|pdf)` or `preview.png`.

### `302` redirect to `/sign-in` — report route
A free/pro file requested while signed out. The original path is preserved as `redirect_url`. Correct gating.

### `302` redirect to `/pricing` — report route
A `pro.*` file requested by a signed-in non-subscriber. Correct gating.

### `302` redirect to an `*.r2.cloudflarestorage.com` URL — report route
Success: the gated handler signed a short-lived URL (120s for gated files, 600s for public previews) and is handing the browser off to the R2 origin. Gated responses carry `Cache-Control: private, no-store`; public previews `public, max-age=300`.

### `401 Unauthorized` — cron (`/api/cron/new-editions`)
`isAuthorizedCron` rejected the request. Either `CRON_SECRET` is unset (**fail-closed** — the endpoint is never world-callable) or the `Authorization` header isn't exactly `Bearer <CRON_SECRET>` (scheme prefix required, length-checked, constant-time compare). Fix: set `CRON_SECRET`; send the exact bearer (`../testing/integration-tests.md`).

### Page redirects (`/admin`, `/account`)
- `/admin` -> `/sign-in` (not signed in) or `/account` (signed in, not admin). `/account` -> `/sign-in` (not signed in). These are server-side guards, not errors (`../admin/permissions.md`).

## JSON responses

### Cron success
`{ ok: true, editions: N, pushes: P, digests: D, alerts: A }`
- `editions` — today's non-hidden editions found. `0` means nothing is dated today.
- `pushes` — web-push notifications sent (digest + per-instrument). `0` with subscribers present usually means VAPID unset or no `push_subscriptions` rows.
- `digests` — fallback digest emails (only to confirmed subscribers NOT reached by push).
- `alerts` — fallback per-instrument emails to followers not reached by push.

### Cron degraded
- `{ ok: false, reason: "no-db" }` — DB unconfigured (`sql` is null). Set `DATABASE_URL`.
- `{ ok: false, reason: "error" }` with HTTP 500 — an exception during the run; check Vercel logs.

### Lemon Squeezy webhook
- `{ ok: true, skipped: "stale" }` — an out-of-order/duplicate event older than the last applied for that subscription was ignored (idempotency). Normal.
- A rejected (bad-signature) webhook returns an unauthorized/4xx and **does not change access** — silent fail-closed. If users report stale access, suspect a secret mismatch, not a crash.

## Server-action results (admin / push)

Server actions return `{ ok: boolean, message?: string }` rather than throwing to the user:
- "Not authorized" / a thrown error from `requireAdmin()` — the caller isn't an admin (the action re-checks server-side regardless of UI).
- "Database not configured." — `sql` null; the action can't run.
- "Bad edition id." / "Bad status." / "Bad feedback id." — input failed validation (regex / whitelist).
- "Couldn't cancel via Lemon Squeezy (...). Check `LEMONSQUEEZY_API_KEY`." — revoke-a-paying-subscriber needs the LS API key.
- "Clerk request failed — is Clerk configured?" — Clerk keys missing/wrong.
- Push: "Sign in to enable notifications." (logged out), "Notifications are unavailable right now." (DB null), "Invalid subscription." (missing endpoint/keys).

## Engine (Python) exits

- **`SystemExit(2)`** from `scaffold_payload.py` / `social_posts.py` — a QA gate tripped (`THESIS_BLOCKED`, free/Pro vocab leak, invalid claim status, banned social wording, invalid manual id, etc.). The message names the violation; cross-reference `test_scaffold_payload.py` / `test_social_posts.py` / `test_score_report.py`.
- **`TaxonomyError`** (a `ValueError`) — an invalid taxonomy value (typo in `prediction_type`/`direction`/`asset_class`/etc.) (`test_taxonomy.py`).
- **`test_firewall.py` non-zero exit** — a scoring module referenced a marketing metric or `engagement.ts` imported a scoring module; the output lists file + line.

## Build

- `next build` failing on types blocks deploy (Vitest does not type-check). Fix the type.
- A CSP-blocked resource appears as a browser console CSP violation, not a server error — diagnose with Report-Only (`../deployment/rollback.md`).

## Related docs

- `common-issues.md`, `faq.md`.
- `../operations/debugging.md`, `../operations/incident-response.md`.
