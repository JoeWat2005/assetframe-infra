# Track record page

- **Route:** `/track-record`
- **File:** `app/track-record/page.tsx` (server component, `export const dynamic = "force-dynamic"`).
- **Access:** Public **headline**; the full record requires `getEntitlement().subscribed` (Pro or admin-comp).
- **Data:** `getEntitlement()`, `getTrackRecord()`, `getCatalog()` (all from `lib/content.ts` / `lib/entitlements.ts`).

## Two render paths

### Not subscribed (signed-out or free)
Shows a four-tile headline (same numbers as the homepage strip):
- Reports published = `editions.length`
- Directional accuracy = `tr.stats.hitRate` (or `—` when nothing graded)
- Public archive = `100%`
- Forecasts scored = `tr.stats.predictionsGraded`

Plus a `Note` explaining the full record is a Pro benefit, and a CTA: a `BuyButton` for signed-in free users, or Sign in / See pricing links for signed-out users. **No open calls, scored rows, analytics or calibration are rendered.**

### Subscribed
Renders the full ledger:
- The same headline tiles plus a one-line summary (reports, forecasts registered, scored + hit rate, longest streak).
- An explainer strip linking to `/how-it-works`.
- `TrackRecordAnalytics` — charts for hit rate over time, by asset class / prediction type / regime, the calibration curve, component-vs-outcome, and a by-instrument table. Each section renders only if its data array is non-empty.
- `OpenCallsBrowser` — searchable/filterable list of open (not-yet-graded) calls, expandable to per-prediction verdicts (Hit / Miss / No-trigger / Manual). An `assetByTicker` map (built from the catalog) lets calls be filtered by asset class.
- `ScoredResults` — paginated, sortable table of graded calls.
- A calibration table (stated confidence vs realised hit rate vs report count), shown only when `tr.calibration` is non-null.

## Data shape

`getTrackRecord()` returns the `TrackRecord` type (`lib/content.ts`):
- `stats`: `reportsScored`, `openCalls`, `predictionsGraded`, `hitRate`, `longestStreak`, `currentStreak`.
- `open[]`: `OpenCall` rows with nested `predictions[]`.
- `scored[]`: `ScoredRow` rows.
- `calibration`: bucketed hit-rate map, or `null` until ≥10 calls are graded.
- Optional derived analytics: `byInstrument`, `byAssetClass`, `byPredictionType`, `byRegime`, `timeline`, `calibrationCurve`, `componentVsOutcome`.

It is DB-first (Neon) with a JSON fallback (`content/track-record.json`), wrapped in `unstable_cache` (`revalidate: 300`, tag `content`). Streaks are computed in TS: a call "wins" when a strict majority of its predictions are hits (`hits*2 > n`). Calibration buckets are `<=60` / `61-75` / `>75` and require ≥10 graded rows.

## Edge cases

- Empty ledger: all arrays empty, `hitRate` null -> headline shows `—`, scored section shows "No reports scored yet" `Note`.
- The derived analytics are additive and optional everywhere; an older JSON or a DB without the taxonomy columns degrades to empty groupings rather than throwing (the content layer retries queries without the newer columns).

## Related components

`OpenCallsBrowser.tsx`, `ScoredResults.tsx`, `TrackRecordAnalytics.tsx`, `BuyButton.tsx` — see `../frontend/components.md`.

## Related docs

- `../api/endpoints.md` — `GET /api/v1/track-record` exposes the same payload publicly (no gating over the API).
- `../mcp/tools.md` — `get_track_record` MCP tool.
- `pricing.md` — what Pro unlocks.
