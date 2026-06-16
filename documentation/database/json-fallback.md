# Database — JSON fallback (DB-first, file-backed)

## Purpose

The web app reads content **DB-first** but degrades to committed JSON files so the site renders even when the database is unavailable, unconfigured, or behind on a schema migration. This makes preview/local boots and partial outages non-fatal for the public, read-only pages.

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\content.ts`
Fallback data: `web/content/catalog.json`, `web/content/track-record.json`.

## The pattern

Every read in `lib/content.ts` follows the same shape:

```ts
if (sql) {
  try {
    const rows = await sql.query(/* parameterized */);
    return rows.map(rowToEdition);
  } catch {
    /* fall through to JSON */
  }
}
return readJson("catalog.json", []);
```

Two independent triggers send a read to the JSON file:

1. **`sql === null`** — no connection string configured (`lib/db.ts` returns `null`).
2. **Any thrown query error** — including a *missing column* when the DB hasn't had the latest migration applied. The catch is intentionally broad so a schema lag never 500s a page.

`readJson(file, fallback)` reads from `process.cwd()/content/<file>` and returns the typed `fallback` (`[]` / a default object) if the file is missing or unparsable.

## Caching

The catalogue and track-record reads are wrapped in Next's `unstable_cache` (`_getCatalog`, `_getTrackRecord`) so reloads serve from Next's Data Cache rather than re-querying. The **admin** view (`getAllEditions`) is intentionally **uncached** so an admin sees live state immediately after toggling `hidden`.

## Functions and their fallbacks

| Function | DB query | Fallback |
| --- | --- | --- |
| `getCatalog()` / `_getCatalog` | editions (non-hidden) + LEFT JOIN open_calls for confidence | `catalog.json` |
| `getAllEditions()` | all editions incl. hidden (uncached) | `catalog.json` |
| `getEdition(date, slug)` | single edition by id, non-hidden | find in `getCatalog()` |
| `getEditionProKeys(date, slug)` | `pro_html_key`/`pro_pdf_key` | **null** (no JSON fallback — Pro keys aren't in `catalog.json`) |
| `getTrackRecord()` / `_getTrackRecord` | open_calls + predictions + scored | `track-record.json` |

`getEditionProKeys` deliberately returns `null` (not a JSON value) when there's no DB, because the public `catalog.json` does not contain R2 object keys — those are derived/stored DB-side only.

## Edition ↔ open-call join (DB path only)

Confidence is **not** a column on `editions`. On the DB path, `lib/content.ts` LEFT JOINs the open call by a derived id:

```
oc.report_id = 'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug
```

So `2026-06-15/AAPL` → `AF-20260615-AAPL`. On the JSON path, `catalog.json` carries no confidence (the field is `null`), which is why the DB path is preferred when available.

## T12 forward-compat retry

`_getTrackRecord` first tries the projection that includes the T12 columns (`verdict`, `pred_type`). If those columns aren't migrated yet the query throws and the code **retries the original pre-T12 projection** so the DB path keeps working on an older schema. This is the migration-lag tolerance in action: a DB without `track_record_analytics` still serves data.

## Shape compatibility

The TypeScript types (`Edition`, `OpenCall`, `SubCall`, `ScoredRow`, `TrackRecord`) are written so **both** the DB row mappers and the JSON file shapes satisfy them. Several fields are optional precisely because the JSON-fallback rows (written by `export_content.py`) include fields the DB path doesn't select (e.g. `ScoredRow.reportId`, `hits`, `misses`) and vice versa. Consumers must tolerate `undefined`/`[]` for the derived analytics (`byInstrument`, `calibrationCurve`, etc.).

## Edge cases / gotchas

- A DB that is configured but empty returns empty arrays from the query (no error), so the page shows "no reports" rather than falling back to JSON. JSON fallback only happens on `null` or a thrown error.
- `lastPrice` is `""` on the DB path (`rowToEdition` hard-codes it) — that detail lives in the report file, not the editions table.
- Because the catch is broad, a genuine bug in a query can be silently masked as "fell back to JSON". When debugging missing/stale data, check whether the JSON path is being taken.

## Tests

No direct test of the fallback switch. `tests/publish.test.ts` and `tests/search.test.ts` exercise adjacent content helpers.

## Related docs

- [sync-db.md](./sync-db.md) · [schema.md](./schema.md) · [migrations.md](./migrations.md)
