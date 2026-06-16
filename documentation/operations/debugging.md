# Debugging

Practical diagnosis for the web app and the engine. For incident triage/severity see `incident-response.md`; for reverts see `../deployment/rollback.md`.

## Local web app

```bash
cd web
npm run dev      # next dev
npm run build    # next build — also runs type-checking and is a real gate
npm run lint     # eslint
npx vitest       # watch the unit/a11y suite while you work
```

- `web/.env.local` holds local secrets (Clerk test keys, Neon strings, R2 keys). Without it, features degrade rather than crash (see below).
- The app reads a NON-standard Next.js 16 — see `web/AGENTS.md`: "Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." APIs and conventions may differ from older Next.js.

## Graceful-degradation map (why something is "missing" rather than erroring)

Each integration no-ops when its env is unset — so a blank screen/feature is usually a missing env var, not a bug:

| Symptom | Likely cause | Where |
| --- | --- | --- |
| Downloads 503 ("storage not configured") | R2 vars unset | `lib/r2.ts` |
| No emails sent | `RESEND_API_KEY` unset (`sendEmail` -> `{skipped:true}`) | `lib/email.ts` |
| Push toggle says "not configured" | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` unset | `components/PushToggle.tsx` |
| Cron sends email to everyone, never push | VAPID server keys unset (`pushConfigured` false) | `lib/push.ts` |
| Admin shows members but 0 subscribers / no downloads | DB unset or those tables not migrated | `lib/admin-stats.ts` |
| Cron returns `{ok:false,reason:"no-db"}` | DB unset | `app/api/cron/new-editions/route.ts` |
| No cookie banner / no GA | `NEXT_PUBLIC_GA_ID` unset in dev (defaults to GA only in prod) | `components/ConsentAnalytics.tsx` |
| Member search / Pro grant fail | Clerk not configured / wrong keys | `app/admin/actions.ts` |

## Cron debugging

- Manual trigger (the exact bearer Vercel Cron sends):
  ```bash
  curl -i -H "Authorization: Bearer $CRON_SECRET" "https://HOST/api/cron/new-editions"
  ```
- `401` -> `CRON_SECRET` unset/mismatched (fail-closed gate). `{editions:0}` -> nothing dated today. Inspect `pushes/digests/alerts` in the JSON to see which channel fired. Only `GET` is implemented.

## Auth / entitlement debugging

- Truth lives in Clerk `publicMetadata`: `subscribed` (real paid sub, set by the LS webhook), `role`/`adminTier`, and the mirrored LS fields (`subStatus`, `endsAt`, ...). `computeEntitlement` (`lib/access.ts`) derives access from it; the email allow-list is `ADMIN_EMAILS`.
- To reproduce a user's view, read their Clerk metadata, then compare against the matrix in `tests/api-entitlement.test.ts`. Admin = `role==="admin"` OR email in `ADMIN_EMAILS`; admins are comped Pro (`billingActive=false`) unless they also pay.
- Local repro of the pure logic: run `npx vitest run tests/access.test.ts` and add a case.

## Report-route / R2 debugging

- The route (`app/api/report/[...key]/route.ts`) classifies the key (`classifyReportKey`), checks entitlement, then 302s to a signed URL. A `400` means the key failed the allow-list (wrong shape / traversal attempt). A `503` means R2 is unconfigured. A redirect to `/sign-in` or `/pricing` means the entitlement gate fired — that is correct behaviour, not a bug.
- Test the validator directly: `npx vitest run tests/sec-report-key.test.ts`.

## Webhook debugging

- Verification is timing-safe and fail-closed. A wrong secret means **silent rejection** (no error to the user; access just doesn't change). Confirm `LEMONSQUEEZY_WEBHOOK_SECRET` / `CLERK_WEBHOOK_SECRET` match the provider dashboards.
- Reproduce the verifier locally: `npx vitest run tests/sec-webhooks.test.ts` and feed it your payload/secret.

## Engine debugging (Python)

- Run any engine test directly: `python scripts/test_confidence.py` (etc.). They are deterministic, so a failure is reproducible.
- `--dry-run` exists on `score_report.py` and `calibrate.py` — use it to inspect verdicts / a refit map without touching the ledger.
- The QA gate aborts a build with a specific reason (`THESIS_BLOCKED`, free/Pro split, R:R lint, etc.) — the message names the violation. Cross-reference `test_scaffold_payload.py` / `test_taxonomy.py`.
- **Firewall failures:** `python scripts/test_firewall.py` lists the offending file + line if a scoring module referenced a marketing metric, or `web/lib/engagement.ts` imported a scoring module. Remove the cross-reference; the two domains must stay separate (`../analytics/tracking.md`).

## Build/type errors

- `npm run build` failing on types is the most common pre-deploy blocker. The Vitest config does not type-check; the Next build does. Fix types there before pushing.

## Vercel production debugging

- Project -> Logs (runtime), the Cron tab, and Deployments (which build is live). Remember env values are write-only — you cannot read a secret back to confirm it; overwrite and redeploy if in doubt.

## Related docs

- `incident-response.md`, `../deployment/rollback.md`, `../deployment/environment-variables.md`.
- `../testing/strategy.md` (reproduce-with-a-test mindset), `../testing/integration-tests.md` (manual flows).
