# Security — Threat model

A pragmatic threat model for AssetFrame, grounded in what the code actually defends. AssetFrame is a content site selling a single subscription; the crown jewels are (a) paid Pro report files, (b) the integrity of who has paid, and (c) user emails.

## Assets

| Asset | Where | Why it matters |
| --- | --- | --- |
| Pro report files | R2 (private bucket `assetframe-pro`) | the paid product |
| Entitlement truth (`subscribed`) | Clerk `publicMetadata` | decides who reads Pro |
| Subscription -> user mapping | `billing_subscriptions` (Neon) | drives revokes/refunds |
| User PII (emails) | Clerk; `subscribers`, `feedback`, `download_log` | privacy / PECR-GDPR |
| Secrets | env (Clerk, LS, R2, VAPID, cron) | full compromise if leaked |

## Trust boundaries

1. **Browser <-> Next server** — all access decisions made server-side; the client never decides entitlement.
2. **Next server <-> R2** — credentials server-only; clients get only short-lived signed URLs.
3. **Lemon Squeezy -> webhook** — untrusted until HMAC-verified; account binding requires a verified payer email or our own signed token.
4. **Clerk -> webhook** — untrusted until Svix-verified (with a replay window).
5. **Vercel Cron -> cron route** — untrusted until `Bearer CRON_SECRET` matches (timing-safe), fail-closed.
6. **Public REST/MCP -> data layer** — inputs validated (`isValidReportRef`) before any query; queries parameterized.

## Threats and mitigations

| Threat | Mitigation | Doc |
| --- | --- | --- |
| Unpaid user reads Pro files | tier gate on `/api/report`; `subscribed` required for `pro.*` | [auth-boundaries.md](./auth-boundaries.md) |
| Direct-to-R2 access bypassing the gate | bucket is private; only short-lived signed URLs leave the server | [../storage/signed-urls.md](../storage/signed-urls.md) |
| Path traversal / arbitrary object fetch | anchored allow-list `classifyReportKey`; `null` -> 400 | [input-validation.md](./input-validation.md) |
| Forged billing webhook grants Pro | HMAC-SHA256 timing-safe verify of raw body | [webhook-security.md](./webhook-security.md) |
| Granting Pro to a victim account via forged `user_id` | only a **verified** payer email or our signed checkout token binds an account | [webhook-security.md](./webhook-security.md) |
| Replayed/out-of-order billing event | `updated_at` staleness check; stale events skipped | [../billing/webhooks.md](../billing/webhooks.md) |
| Refund/chargeback but access lingers | refund event forces revoke regardless of status | [../billing/subscription-lifecycle.md](../billing/subscription-lifecycle.md) |
| Replayed Clerk webhook | Svix verify + 5-min timestamp window | [webhook-security.md](./webhook-security.md) |
| Anonymous trigger of the cron | `isAuthorizedCron` Bearer compare, fail-closed if no secret | [auth-boundaries.md](./auth-boundaries.md) |
| SQL injection | every query parameterized; no string interpolation of input | [input-validation.md](./input-validation.md) |
| XSS / data exfiltration via injected script | enforced CSP (caveat: `script-src 'unsafe-inline'`) | [csp.md](./csp.md) |
| Clickjacking | `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` | [security-headers.md](./security-headers.md) |
| MITM / protocol downgrade | HSTS (2yr, preload) + `upgrade-insecure-requests` | [security-headers.md](./security-headers.md) |
| One user deleting another's push subscription | delete scoped to `endpoint AND clerk_user_id` | [auth-boundaries.md](./auth-boundaries.md) |
| Marketing engagement contaminating research | hard firewall; scoring never reads `social_engagement` | [../database/tables.md](../database/tables.md) |

## Known gaps / accepted risk (documented backlog)

- **No `/api/*` rate limiting.** There is no Vercel Firewall / Upstash limiter in front of the API or webhooks. Abuse/DoS of the public REST API and the webhook endpoints is not currently throttled. **Backlog.**
- **CSP `script-src 'unsafe-inline'`.** Inline scripts are permitted (Next bootstrap + Clerk + Recharts). The hardened follow-up is a per-request **nonce**. **Backlog.** See [csp.md](./csp.md).
- **Unresolved billing revokes** are logged but not auto-retried — a residual fail-open that's observable in the audit log.
- **Best-effort logging/mapping** (download_log, billing_subscriptions on a missing-table path) can silently no-op; access stays correct but observability degrades.

## Non-goals

- No card data is handled (Lemon Squeezy is Merchant of Record) -> no PCI scope.
- No user-generated content is rendered as HTML beyond report files the system itself generates.

## Related docs

- [csp.md](./csp.md) · [security-headers.md](./security-headers.md) · [auth-boundaries.md](./auth-boundaries.md) · [webhook-security.md](./webhook-security.md) · [input-validation.md](./input-validation.md)
