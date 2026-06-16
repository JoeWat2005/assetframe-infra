# Developer pages

Three public pages under `/developers`, all server components with static metadata.

## `/developers` (Overview)

- **File:** `app/developers/page.tsx`.
- **Access:** Public.
- Three cards: **MCP server** (-> `/developers/mcp`), **REST API** (-> `/developers/api`), **OpenAPI schema** (external link to `{SITE.url}/api/v1/openapi.json`).
- Explains the free tier covers the full catalog, each free Snapshot and the public track record with no key; only the paid Pro analysis sits behind a subscription (and OAuth over MCP).
- **Exports `AgentGuidance`** — a reusable section reused by the MCP and API pages. It states four authoritative rules for any agent surfacing AssetFrame data:
  1. **Cite the source** — attribute to AssetFrame, name instrument + report date, link the edition (`{BASE}/reports/{date}/{slug}`).
  2. **Treat confidence as calibrated, not a promise** — the 0–100 value is scored after the window closes; not a guarantee, probability of profit, or trade signal; present it with risk + window.
  3. **Explain the ledger honestly** — predictions registered before the session, graded Hit/Miss/No-trigger, append-only.
  4. **Avoid investment-advice language** — general research, not regulated advice; surface the disclaimer that ships in every payload.

## `/developers/mcp` (MCP server)

- **File:** `app/developers/mcp/page.tsx`.
- **Access:** Public (the docs themselves; the server's Pro tool is OAuth-gated).
- Documents the hosted MCP server at `{SITE.url}/api/mcp` over Streamable HTTP.
- Connection recipes (rendered via the `CodeBlock` client component): Claude Code (`claude mcp add --transport http assetframe {MCP_URL}`), Claude Desktop (`claude_desktop_config.json`), Cursor (`~/.cursor/mcp.json`), Perplexity / other clients via `mcp-remote`, and LangChain via `langchain_mcp_adapters`. ChatGPT is explicitly noted as not supporting generic MCP yet (use the REST API + Custom GPT Action).
- A hardcoded `TOOLS` reference table marks the four free tools (`list_reports`, `search_reports`, `get_report`, `get_track_record`) "Free · no auth" and `get_pro_report` "OAuth + Pro".
- A "Pro access (OAuth)" section walks through OAuth discovery via `/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server`, notes Dynamic Client Registration is enabled (nothing to pre-register), and describes the sign-in pop-up flow.

## `/developers/api` (REST API)

- **File:** `app/developers/api/page.tsx`.
- **Access:** Public.
- Documents the read-only JSON API at `{SITE.url}/api/v1`, CORS-open, no key. Shows the OpenAPI URL and three endpoints with example responses: `GET /reports`, `GET /reports/{date}/{slug}`, `GET /track-record`.
- Integration recipes: ChatGPT Custom GPT Action (import OpenAPI URL), curl, LangChain Python tool wrapper.

Both sub-pages render the shared `AgentGuidance` block and the `SITE.disclaimer`.

## Shared component

`app/developers/CodeBlock.tsx` — client component rendering a dark code block with a copy-to-clipboard button (used for all install commands / example requests).

## Edge cases / notes

- All example payloads on these pages are **hardcoded illustrative samples**, not live data. The live schema is at `/api/v1/openapi.json` and the live data at the `/api/v1/*` routes.
- The pages are static; `BASE`/`MCP_URL`/`API` are derived from `SITE.url` at build time (resolves per environment).

## Related docs

- `../api/` — the full REST API reference (overview, endpoints, auth, examples).
- `../mcp/` — the full MCP reference (overview, tools, auth, examples).
- `navigation.md` — the "Developers" nav category.
