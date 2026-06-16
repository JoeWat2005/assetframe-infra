# MCP server overview

AssetFrame runs a hosted **Model Context Protocol** server so AI clients (Claude Code, Claude Desktop, Cursor, and any MCP-capable framework) can read the published research as tools.

- **Endpoint:** `{SITE.url}/api/mcp` (e.g. `https://www.assetframe.co.uk/api/mcp`).
- **Transport:** Streamable HTTP (SSE disabled — `disableSse: true`).
- **Implementation:** `app/api/mcp/route.ts` using `mcp-handler` (`createMcpHandler`) wrapped with `experimental_withMcpAuth`. `serverInfo` = `{ name: "assetframe", version: "1.0.0" }`. `basePath: "/api"`. `maxDuration = 60`.
- **HTTP methods:** `GET`, `POST`, `DELETE` all map to the same auth-wrapped handler.

## Tools (5)

| Tool | Access | Purpose |
|---|---|---|
| `list_reports` | Free (no auth) | List editions (Snapshot metadata), optional `asset_class`/`status`/`date`/`limit` filters. |
| `search_reports` | Free | Search by instrument name or ticker. |
| `get_report` | Free | One report's free Snapshot: metadata + `snapshotText` + short-lived PDF link. |
| `get_track_record` | Free | Public track record (stats, open, scored, calibration). |
| `get_pro_report` | **OAuth + Pro** | Full Pro analysis text + short-lived Pro PDF link. |

The four free tools require **no authentication**; `get_pro_report` requires a Clerk OAuth sign-in **and** a live Pro subscription. Full reference: `tools.md`.

## Free vs Pro

Same boundary as the rest of the platform: free data (catalog, Snapshot, track record) flows over MCP unauthenticated; Pro is OAuth + subscription gated. `experimental_withMcpAuth({ required: false })` keeps the free tools usable without a token, and `get_pro_report` enforces auth itself, so an OAuth/Clerk misconfiguration can never take down the free tools (the auth callback is wrapped in try/catch and returns `undefined` on error).

## Shared content layer

The MCP tools call the exact same `lib/reports-api.ts` builders as the REST API (`listReports`, `getReportDetail`, `getProReportDetail`, `getTrackRecordPayload`), so payloads match the REST shapes and every response carries `SITE.disclaimer`. Tool results are returned as a single text content block of pretty-printed JSON; error/empty cases return a short text note with `isError: true`.

## OAuth discovery

Two RFC metadata routes let OAuth-capable clients discover Clerk's endpoints:
- `/.well-known/oauth-protected-resource` (RFC 9728) — names Clerk as the authorization server protecting `/api/mcp`.
- `/.well-known/oauth-authorization-server` (RFC 8414) — proxies Clerk's authorize/token/registration endpoints.

Dynamic Client Registration is enabled, so clients self-register (nothing to pre-provision). See `auth.md`.

## Client setup (summary)

- Claude Code: `claude mcp add --transport http assetframe {MCP_URL}`.
- Claude Desktop / Cursor: add the server to the client's MCP JSON.
- Perplexity / other clients without native HTTP transport: bridge via `npx mcp-remote {MCP_URL}` (this also drives the OAuth pop-up for Pro).
- ChatGPT: no generic MCP support yet — use the REST API + Custom GPT Action.

Full recipes + JSON: `examples.md`.

## Related docs

- `tools.md`, `auth.md`, `examples.md`.
- `../api/overview.md` — the same free data over REST.
- `../backend/api-routes.md` — server-side handler.
- `../website/developers.md` — the human-facing MCP docs page.
