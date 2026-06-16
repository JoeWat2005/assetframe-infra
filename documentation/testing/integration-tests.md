# Integration tests

AssetFrame has no separate "integration test" runner. Integration coverage comes from two places:

1. **jsdom component-integration tests** in the Vitest suite, which render real components wired to mocked framework boundaries (Clerk, `next/navigation`, server actions).
2. **A manual end-to-end playbook** (below) that exercises the live system, including the web-push alert flow, which has no automated equivalent.

## 1. Automated component-integration tests (jsdom)

These differ from the pure unit tests in that they mount a real React tree and assert on rendered structure/roles, not just function return values. They live in `web/tests/a11y-components.test.tsx` and run under `// @vitest-environment jsdom`.

Real components rendered (imported via the `@/` alias from `vitest.config.ts`):
- `components/Header.tsx` — desktop nav + mobile sheet trigger.
- `app/feedback/FeedbackForm.tsx` — the public feedback form.
- `components/ui` primitives (`Hero`, `Section`, `Note`, `Badge`).

Framework boundaries are stubbed so the components mount in isolation:
- `next/link` -> plain `<a>`, `next/image` -> plain `<img>`.
- `next/navigation` -> `usePathname()` returns `/`, `useRouter()` returns `{push, replace}` stubs.
- `@clerk/nextjs` -> `useUser()` signed-out, `useClerk()` with a `signOut` stub, `UserButton` as a labelled button.
- `app/feedback/actions` -> `submitFeedback` resolves `{ ok: true, message: "Thanks!" }` (the server action is not invoked for real).
- A `matchMedia` polyfill is installed for Radix/Header effects, and Testing Library cleanup is called explicitly in `afterEach` (because `globals: false` means auto-cleanup is not registered).

What these assert: the Header exposes accessible category triggers ("Company", "Developers", "Product", "Research") and a labelled mobile menu button (`/open menu/i`); every FeedbackForm control is labelled (textarea `/your feedback/i`, email, the category combobox, the submit button); and a representative page composition has exactly one `h1` and at least one `h2` (valid heading order). All three render trees also assert no axe violations — see `accessibility-tests.md`.

> What they do NOT cover: real navigation, real auth redirects, real server actions, the DB, R2, or the network. That is the manual playbook's job.

### Run

```bash
cd web
npx vitest run tests/a11y-components.test.tsx
```

## 2. Manual integration-test playbook

This is the canonical way to verify the full MVP before a release, because the DB, R2, Clerk, Lemon Squeezy, the cron, and web push are never touched by the automated suites. Run it against a preview deploy (Neon `development` branch) or, carefully, production.

### Prerequisites

- Environment configured per `../deployment/environment-variables.md`. For the push portion you specifically need `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; for the email fallback you need `RESEND_API_KEY` (and `RESEND_FROM` once your domain is verified); for the cron you need `CRON_SECRET`.
- A free AssetFrame (Clerk) account, and a second account with Pro for the gated checks. The signed-in account's email should match a `subscribers`/`watchlists` row where relevant.
- Chrome (or another browser that supports the Push API + service workers) over HTTPS — push does not work on plain `http://` except `localhost`.

### Phase A — build and core sanity

1. `cd web && npm run build` — must complete with no type errors. The build is itself a gate.
2. `npx vitest run` — the whole web suite must pass.
3. From `mvp/`, run the Python suite (`python scripts/test_*.py`, each file) — all green; `python scripts/test_firewall.py` prints `FIREWALL OK`.

### Phase B — auth + entitlement gating (matches `tests/api-entitlement.test.ts` in the real UI)

4. Signed out: `/reports` lists Snapshots; opening a free Snapshot redirects to `/sign-in` (free tier needs an account); `/account` and `/admin` redirect to `/sign-in`.
5. Free account: can open a free Snapshot; opening a Pro report (`/api/report/<date>/<slug>/pro.pdf`) redirects to `/pricing`.
6. Pro account: the same Pro URL 302-redirects to a short-lived signed R2 URL and the PDF renders. (The route is `app/api/report/[...key]/route.ts`; gated files get a 120s URL and `Cache-Control: private, no-store`.)
7. Admin (email in `ADMIN_EMAILS`): `/admin` renders; on `/admin`, "Preview tier" -> Free hides Pro but keeps admin (verifies `adminTier`).

### Phase C — publication round-trip (see `../operations/publication-workflow.md`)

8. Generate/score an edition dated **today** via the `/mvp` skill, then `python scripts/export_content.py`, `python scripts/publish.py`, and `(cd web && npm run sync-db)`. Confirm the edition appears on `/reports` and in `/api/v1/reports`, and that `preview.png` loads (public tier, cacheable).

### Phase D — web-push alert flow (the headline manual test; no automated equivalent)

This exercises `components/PushToggle.tsx` -> `lib/push-actions.ts` -> `push_subscriptions` table -> `app/api/cron/new-editions/route.ts` -> `lib/push.ts` -> `public/sw.js`, with `lib/email.ts` as the documented fallback.

9. **Enable push.** Sign in as the free account. Go to `/account` -> "Notifications" -> click **Enable push notifications**. Grant the browser permission prompt. The button must flip to "Push notifications are on". Behind the scenes this registers `/sw.js`, subscribes via `PushManager` with the VAPID key, and calls `saveSubscription(..., ["digest"])`, which upserts a row in `push_subscriptions` keyed by endpoint with your `clerk_user_id` and topic `digest`.
   - If you instead see "Push notifications aren't configured yet", `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is missing — fix env before continuing.
   - (Optional, for the per-instrument path) On `/account` -> "Following", follow an instrument whose **slug** matches an edition you will publish today. The cron pushes a per-instrument alert to followers via the `watchlists` join.
10. **Have a today-dated edition live.** Use the edition from Phase C (its `report_date` must equal `CURRENT_DATE` in the DB — the cron query filters `report_date = CURRENT_DATE AND coalesce(hidden,false)=false`). If you skipped Phase C, publish/sync any edition dated today.
11. **Trigger the cron manually** with the bearer token Vercel Cron would send. The gate (`lib/cron.ts`, `isAuthorizedCron`) is fail-closed and does a constant-time, length-checked compare against `Bearer $CRON_SECRET`:

    ```bash
    # Replace HOST and SECRET. GET is the implemented method.
    curl -i -H "Authorization: Bearer $CRON_SECRET" \
      "https://HOST/api/cron/new-editions"
    ```

    Expected JSON: `{ "ok": true, "editions": N, "pushes": P, "digests": D, "alerts": A }`.
    - `editions` > 0 (it found today's editions). If it is 0, no edition is dated today — recheck step 10.
    - With push configured and your subscription present, `pushes` >= 1.
12. **Expect a Chrome notification.** Within a few seconds the OS/Chrome shows an AssetFrame notification ("New AssetFrame editions — N today" for the digest, or "New edition: <instrument>" if you followed its slug). Clicking it focuses an open AssetFrame tab or opens `/reports` (or the edition URL) — handled by the `notificationclick` listener in `public/sw.js`.
13. **Verify the email fallback rule.** The cron only emails users it did **not** reach by push. So:
    - For a confirmed `subscribers` row whose user has a push subscription: **no** digest email (counted out of `digests`).
    - For a confirmed subscriber with **no** push subscription (e.g. a second account that never enabled push, or with push unconfigured entirely): a digest email arrives via Resend. To test the fallback cleanly, disable push on `/account` ("Turn off" deletes your `push_subscriptions` row) and re-run step 11 — `digests`/`alerts` should now include you.
    - Per-instrument email alerts go to followers with no active push sub, resolved to an email via Clerk.

### Authorization checks while you are here

14. Re-run the curl with a wrong/missing token and with no `CRON_SECRET` set in the env — every variant must return `401 Unauthorized`. This mirrors `tests/api-cron.test.ts`.

### Cleanup

15. "Turn off" on `/account` removes your push subscription; unhide/hide editions from `/admin` -> Editions if you published test data; the outcome ledger is append-only and is never edited.

## Edge cases worth exercising manually

- **Push unconfigured.** With VAPID unset, the cron behaves exactly as the pre-push system: it emails every confirmed subscriber and every follower (`pushConfigured` is false, so `pushedUserIds` stays empty). The PushToggle shows the "not configured" state.
- **Expired endpoint.** If the push service returns 404/410, `lib/push.ts` reports `{expired:true}` and the cron prunes that row from `push_subscriptions` (best-effort).
- **DB down.** The cron returns `{ ok: false, reason: "no-db" }`; the download-log insert and audit-log writes are best-effort and never break the request.
- **Two editions same day.** The digest body switches from a single instrument line to a comma list; followers get one per-instrument push per matched slug.

## Related docs

- `strategy.md`, `unit-tests.md`, `e2e-tests.md`, `security-tests.md`.
- `../operations/publication-workflow.md`, `../operations/daily-operations.md`.
- `../deployment/environment-variables.md` (VAPID, RESEND, CRON_SECRET).
