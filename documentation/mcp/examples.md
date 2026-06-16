# MCP client examples

Server endpoint: `{SITE.url}/api/mcp` (examples use `https://www.assetframe.co.uk/api/mcp`). Transport: Streamable HTTP. Four free tools need no auth; `get_pro_report` triggers an OAuth sign-in (see `auth.md`).

## Claude Code

One command registers the server over HTTP transport:

```bash
claude mcp add --transport http assetframe https://www.assetframe.co.uk/api/mcp
```

## Claude Desktop

Settings -> Developer -> Edit Config, add to `claude_desktop_config.json`, then restart:

```json
{
  "mcpServers": {
    "assetframe": {
      "type": "http",
      "url": "https://www.assetframe.co.uk/api/mcp"
    }
  }
}
```

## Cursor

Settings -> MCP -> Add new server, or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "assetframe": {
      "url": "https://www.assetframe.co.uk/api/mcp"
    }
  }
}
```

## Perplexity & other clients (via mcp-remote)

For clients without a native HTTP transport, bridge through `mcp-remote`. This also drives the OAuth pop-up needed for `get_pro_report`:

```json
{
  "mcpServers": {
    "assetframe": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://www.assetframe.co.uk/api/mcp"]
    }
  }
}
```

## LangChain / MCP adapters (Python)

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "assetframe": {"transport": "streamable_http", "url": "https://www.assetframe.co.uk/api/mcp"},
})
tools = await client.get_tools()  # list_reports, search_reports, get_report, get_track_record
```

(The OAuth-gated `get_pro_report` needs an OAuth-capable client; plain adapters load the four free tools.)

## ChatGPT

ChatGPT does not support generic MCP servers yet. Use the REST API with a Custom GPT Action and import the OpenAPI schema (`https://www.assetframe.co.uk/api/v1/openapi.json`) instead — see `../api/examples.md`.

## Sample tool result (`get_report`)

```json
// get_report -> date: "2026-06-15", slug: "BTC"
{
  "id": "2026-06-15/BTC",
  "date": "2026-06-15",
  "instrument": "Bitcoin",
  "ticker": "BTC",
  "assetClass": "crypto",
  "status": "Wait",
  "risk": "High",
  "confidence": 60,
  "windowEnd": "2026-06-16T20:00:00Z",
  "snapshotText": "AssetFrame Snapshot — Bitcoin (BTC) ...",
  "snapshotPdfUrl": "https://.../free.pdf?X-Amz-Expires=600...",
  "proAvailable": true,
  "proAccess": "Subscribe at https://www.assetframe.co.uk/pricing to unlock the full Pro analysis.",
  "disclaimer": "AssetFrame publishes general market research ..."
}
```

## Using the Pro tool

1. Connect with an OAuth-capable client (Claude Desktop, Cursor, or any client via `mcp-remote`).
2. The client discovers Clerk's OAuth endpoints from `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`; DCR is on, so it self-registers.
3. Call `get_pro_report` with `{ date, slug }`. A sign-in window opens — sign in with the AssetFrame account holding your Pro subscription.
4. With an active subscription you get the full `proText` + a short-lived `proPdfUrl`; otherwise a message pointing to `/pricing`.

## Notes

- These recipes mirror the live `/developers/mcp` page (`app/developers/mcp/page.tsx`).
- All free-tool values match the REST API and carry the disclaimer.

## Related docs

- `overview.md`, `tools.md`, `auth.md`.
- `../api/examples.md` — REST / ChatGPT path.
