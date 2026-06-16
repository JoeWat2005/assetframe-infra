# REST API overview

AssetFrame exposes a **read-only JSON REST API** at `/api/v1/*` for the report catalog, individual free Snapshots, and the public track record. It is the same content/R2 layer the website uses (`lib/reports-api.ts`).

- **Base URL:** `{SITE.url}/api/v1` (e.g. `https://www.assetframe.co.uk/api/v1`).
- **Auth:** none — the free tier is public.
- **CORS:** wide open (`Access-Control-Allow-Origin: *`, methods `GET, OPTIONS`), so it is callable from the browser.
- **Format:** `application/json; charset=utf-8`, pretty-printed (2-space).
- **Caching:** `Cache-Control: public, max-age=60, s-maxage=300` on data routes; the OpenAPI doc is `max-age=3600, s-maxage=86400`.
- **Disclaimer:** every payload includes `SITE.disclaimer` (research/decision-support, not advice).

## What is and isn't exposed

**Exposed (free):**
- Catalog metadata — instrument, ticker, asset class, directional status, risk, bias, calibrated confidence (0–100 or null), window end, `hasPro`, canonical URL.
- One report's **free Snapshot** — the metadata above plus `snapshotText` (plain-text rendering of the one-page Snapshot) and `snapshotPdfUrl` (a short-lived ~600s signed PDF link).
- The public **track record** — aggregate stats, open (not-yet-graded) calls with their predictions, scored results, and per-confidence calibration.

**Not exposed:** the paid Pro analysis. The detail endpoint returns `proAvailable` + a `proAccess` pointer to `/pricing`, but never Pro text or a Pro link. Internal R2 file keys and the `hidden` flag are never serialised (asserted by `tests/api-v1-shape.test.ts`). Pro content is available to subscribers only over MCP (`get_pro_report`, OAuth) — see `../mcp/`.

## OpenAPI

A machine-readable **OpenAPI 3.1** document is served at `/api/v1/openapi.json` (`app/api/v1/openapi.json/route.ts`, `force-static`). It mirrors the real route shapes and is importable by ChatGPT Custom GPT Actions, LangChain tool loaders, and any OpenAPI client. `servers[0].url` and example URLs are derived from `SITE.url` at build time.

## Endpoints (summary)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/reports` | List/filter published editions (Snapshot metadata). |
| `GET /api/v1/reports/{date}/{slug}` | One report's free Snapshot (metadata + text + signed PDF link). |
| `GET /api/v1/track-record` | Public track record (stats, open, scored, calibration). |
| `GET /api/v1/openapi.json` | The OpenAPI 3.1 schema. |

Full parameters, response shapes, validation and errors: `endpoints.md`. Auth/CORS specifics: `auth.md`. Copy-paste curl: `examples.md`.

## Positioning

This is a research data API, not a trading or execution API (and the platform never places trades). Responses are briefly edge-cached. For agent-facing behaviour rules (cite the source, treat confidence as calibrated, explain the ledger, avoid advice language) see the shared "Guidance for agents" block documented in `../website/developers.md`.

## Related docs

- `endpoints.md`, `auth.md`, `examples.md`.
- `../mcp/overview.md` — the same data over MCP, plus Pro.
- `../backend/api-routes.md` — server-side handler index.
- `../website/developers.md` — the human-facing API docs page.
