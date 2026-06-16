# REST API endpoints

Base URL `{SITE.url}/api/v1`. All endpoints: read-only, no auth, CORS-open, every payload carries `disclaimer`. Source: `app/api/v1/**` + `lib/reports-api.ts` + `lib/http.ts`. Canonical schema: `/api/v1/openapi.json`.

## `GET /api/v1/reports`

List published editions as free Snapshot metadata. `force-dynamic`.

**Query params** (all optional):
| Param | Type | Notes |
|---|---|---|
| `asset_class` | string | Case-insensitive exact match (`crypto`, `equity`, `fx`, `commodity`, `index`). |
| `status` | string | Case-insensitive exact match (`Buy`, `Sell`, `Wait`). |
| `date` | string | Exact ISO date `YYYY-MM-DD`. |
| `q` | string | Free-text over instrument + ticker + slug (lowercased substring). |
| `limit` | integer | Clamped to **1–200**, default 50. Non-positive -> 1. |

**200 response:**
```json
{
  "total": 21,
  "returned": 5,
  "reports": [ { /* ReportSummary */ } ],
  "disclaimer": "AssetFrame publishes general market research ..."
}
```

**ReportSummary** (`lib/reports-api.ts toSummary`): `id` (`"{date}/{slug}"`), `date`, `slug`, `instrument`, `ticker`, `assetClass`, `status`, `risk`, `bias`, `confidence` (integer **or null**, never undefined), `windowEnd`, `hasPro` (boolean), `url` (`{BASE}/reports/{date}/{slug}`). No Pro file keys, no `hidden` flag.

`total` = matches before limit; `returned` = `min(total, limit)`.

## `GET /api/v1/reports/{date}/{slug}`

One report's free Snapshot. `force-dynamic`.

**Path params:** `date` (`YYYY-MM-DD`), `slug` (e.g. `BTC`).

**Validation:** `isValidReportRef(date, slug)` (`lib/report-key.ts`) runs **before** the data layer — anchored date grammar (`\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])`) + slug `[A-Za-z0-9_-]+` with `length <= 64`. Anything malformed (path traversal, query junk, over-long) returns the same 404 as a real miss. Defence in depth: the DB lookups are already parameterised.

**200 response** = ReportSummary plus:
- `snapshotText` — plain-text rendering of the one-page Snapshot HTML (`htmlToText`), `""` if the HTML object is missing.
- `snapshotPdfUrl` — short-lived (~600s) signed R2 PDF URL, or `null`.
- `proAvailable` — boolean (`= hasPro`).
- `proAccess` — `"Subscribe at {BASE}/pricing to unlock the full Pro analysis."` when `hasPro`, else `null`.
- `disclaimer`.

**404 response** (invalid ref OR unknown/hidden edition):
```json
{ "error": "not_found", "message": "No published report for that date/slug." }
```

Hidden editions are absent from the content layer, so they 404 here too. The Pro report text/link is never returned by this endpoint.

## `GET /api/v1/track-record`

Public track record. `force-dynamic`.

**No params.** **200 response** (`getTrackRecordPayload`):
- `stats`: `reportsScored`, `openCalls`, `predictionsGraded`, `hitRate` (number or null), `longestStreak`, `currentStreak`.
- `open[]`: not-yet-graded calls — `reportId`, `instrument`, `symbol`, `view`, `confidence` (string|number), `windowEnd`, `n`, `nManual`, `hits`, `scored`, and `predictions[]` (`id`, `type`, `text`, `manual`, `expect`).
- `scored[]`: graded calls — `instrument`, `view`, `confidence`, `results`, `hitRate`, `windowEnd`.
- `calibration`: object keyed by confidence bucket (`<=60` / `61-75` / `>75`) with `{ hitRate, n }`, or `null` until enough calls are graded.
- `disclaimer`.

## `GET /api/v1/openapi.json`

OpenAPI 3.1 document. `force-static`, cached `max-age=3600, s-maxage=86400`. `info.description` includes the disclaimer; `servers[0].url` = `SITE.url`. Documents the three operations above with `operationId`s `listReports`, `getReport`, `getTrackRecord`.

## CORS & preflight

Every route exports `OPTIONS` -> `apiPreflight()` returning **204** with:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```
`apiJson` adds the same CORS headers + `Cache-Control: public, max-age=60, s-maxage=300` to data responses.

## Errors

| Code | When |
|---|---|
| 200 | Success (lists return an empty `reports[]` when nothing matches — not an error). |
| 404 | Unknown/hidden edition or malformed `{date}/{slug}` on the detail route. |
| 204 | `OPTIONS` preflight. |

There is no auth on these routes, so 401/403 do not occur here. Server errors surface as the framework default.

## Related tests

- `tests/api-v1-shape.test.ts` — asserts the wrapper (`total/returned/reports/disclaimer`), required summary keys, no Pro/`hidden` key leakage, case-insensitive `asset_class`/`q` filters, `limit` clamping to 1–200, `confidence` is number-or-null, and the 404-on-unknown path.
- `tests/report-key.test.ts`, `tests/sec-report-key.test.ts` — `isValidReportRef` / key grammar.

## Related docs

- `overview.md`, `auth.md`, `examples.md`.
- `../mcp/tools.md` — equivalent MCP tools.
- `../backend/api-routes.md`.
