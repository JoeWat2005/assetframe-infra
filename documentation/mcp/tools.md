# MCP tools reference

Server: `{SITE.url}/api/mcp`. Source: `app/api/mcp/route.ts` (`registerTool`), payloads from `lib/reports-api.ts`. Inputs validated with `zod`. Results are a single text block of pretty-printed JSON; misses return a short text note with `isError: true`.

## `list_reports` — Free (no auth)

List published editions (free Snapshot metadata).

**Input** (all optional):
- `asset_class` (string) — e.g. `equity`, `fx`, `crypto`, `commodity`, `index`.
- `status` (string) — `Buy`, `Sell`, `Wait`.
- `date` (string) — ISO `YYYY-MM-DD`.
- `limit` (int, 1–200, default 50).

**Returns:** `{ total, returned, reports[], disclaimer }`. Each report is the ReportSummary (`id, date, slug, instrument, ticker, assetClass, status, risk, bias, confidence, windowEnd, hasPro, url`). No Pro file keys.

## `search_reports` — Free

Search by instrument name or ticker.

**Input:** `query` (string, **required**, min length 1); `limit` (int, 1–200, optional).
**Returns:** same shape as `list_reports`, filtered (internally `listReports({ query, limit })`).

## `get_report` — Free

One report's free Snapshot.

**Input:** `date` (`YYYY-MM-DD`), `slug` (e.g. `BTC`).
**Validation:** `isValidReportRef(date, slug)` first; invalid -> `note("No published report found for that date/slug.", isError)`.
**Returns:** ReportSummary + `snapshotText` (plain-text Snapshot) + `snapshotPdfUrl` (short-lived ~600s signed link, or null) + `proAvailable` + `proAccess` (pointer to `/pricing` when Pro exists) + `disclaimer`. Unknown/hidden edition -> error note. **Never returns Pro content.**

## `get_track_record` — Free

**Input:** none.
**Returns:** `{ stats, open[], scored[], calibration, disclaimer }` — identical to `GET /api/v1/track-record`. `stats` = `reportsScored, openCalls, predictionsGraded, hitRate, longestStreak, currentStreak`; `calibration` is null until enough calls are graded.

## `get_pro_report` — OAuth + active Pro subscription

The full Pro analysis text plus a short-lived Pro PDF link.

**Input:** `date` (`YYYY-MM-DD`), `slug`.
**Gating (in order):**
1. `userId = extra?.authInfo?.extra?.userId` — if absent -> note: "This tool requires signing in with your AssetFrame account (OAuth). Free Snapshots are available via get_report." (`isError`).
2. `userIsPro(userId)` — looks up the Clerk user, lowercases the primary email, and runs `computeEntitlement(publicMetadata, email, ADMIN_EMAILS).subscribed`. If false -> note pointing to `{SITE.url}/pricing` (`isError`). (Admins are `subscribed` via the comp rule, so they can read Pro over MCP.)
3. `isValidReportRef(date, slug)` -> error note if invalid.
4. `getProReportDetail(date, slug)` — returns null (error note) unless the edition exists **and** `hasPro`.

**Returns:** ReportSummary + `proText` (plain-text Pro report) + `proPdfUrl` (short-lived ~600s signed link) + `disclaimer`. Pro file keys come from `getEditionProKeys` (DB only; returns null without a DB).

## Behavioural notes

- `experimental_withMcpAuth({ required: false })` means the four free tools work with no token; `get_pro_report` enforces auth on its own. The auth callback (`verifyClerkToken(await auth({ acceptsToken: "oauth_token" }), token)`) is wrapped in try/catch -> `undefined`, so misconfiguration degrades to "no userId" (free tools unaffected).
- All tools share the REST content/R2 layer, so values match the REST API and every payload includes the disclaimer.

## Related tests

- `tests/api-v1-shape.test.ts` — the shared payload builders (`listReports`, `getReportDetail`, `getTrackRecordPayload`) the free tools return.
- `tests/access.test.ts`, `tests/api-entitlement.test.ts` — `computeEntitlement`, which gates `get_pro_report`.
- `tests/report-key.test.ts`, `tests/sec-report-key.test.ts` — `isValidReportRef`.

## Related docs

- `overview.md`, `auth.md`, `examples.md`.
- `../api/endpoints.md` — REST equivalents.
