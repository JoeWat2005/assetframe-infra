import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/ui";
import CodeBlock from "../CodeBlock";
import { AgentGuidance } from "../page";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "MCP server",
  description: "Connect Claude Code, Claude Desktop, Cursor and other MCP clients to AssetFrame research. Read-only tools over Streamable HTTP — keyless discovery, OAuth sign-in to read reports.",
  alternates: { canonical: "/developers/mcp" },
};

const BASE = SITE.url.replace(/\/$/, "");
const MCP_URL = `${BASE}/api/mcp`;

// Full tool reference. access: "free" needs no auth; "signin" needs a Clerk OAuth sign-in
// (any account); "pro" needs an OAuth sign-in with a live Pro subscription.
const TOOLS: { name: string; access: "free" | "signin" | "pro"; params: string; returns: string }[] = [
  { name: "list_reports", access: "free", params: "asset_class?, status?, date?, limit? (1–200, default 50)", returns: "{ total, returned, reports[], disclaimer } — Snapshot metadata per edition." },
  { name: "search_reports", access: "free", params: "query (required), limit?", returns: "Same shape as list_reports, filtered by instrument name or ticker." },
  { name: "get_report", access: "signin", params: "date (YYYY-MM-DD), slug (e.g. BTC)", returns: "Snapshot metadata + snapshotText + short-lived snapshotPdfUrl. Requires an OAuth sign-in (any account)." },
  { name: "get_track_record", access: "free", params: "(none)", returns: "{ stats, open[], scored[], calibration, disclaimer }." },
  { name: "get_pro_report", access: "pro", params: "date (YYYY-MM-DD), slug", returns: "Full Pro analysis text + short-lived Pro PDF link. Requires OAuth + active Pro." },
];

const cliCmd = `claude mcp add --transport http assetframe ${MCP_URL}`;

const desktopJson = `{
  "mcpServers": {
    "assetframe": {
      "type": "http",
      "url": "${MCP_URL}"
    }
  }
}`;

const cursorJson = `{
  "mcpServers": {
    "assetframe": {
      "url": "${MCP_URL}"
    }
  }
}`;

const remoteJson = `{
  "mcpServers": {
    "assetframe": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_URL}"]
    }
  }
}`;

const sampleResponse = `// get_report → date: "2026-06-18", slug: "AAPL"  (after OAuth sign-in)
{
  "id": "2026-06-18/AAPL",
  "date": "2026-06-18",
  "slug": "AAPL",
  "instrument": "Apple Inc.",
  "ticker": "AAPL",
  "assetClass": "US equity",
  "assetClassKey": "equity",
  "status": "Wait",
  "risk": "High",
  "bias": "Neutral",
  "confidence": 55,
  "windowEnd": "Thu 18 Jun 2026 21:00 UK",
  "hasPro": true,
  "url": "${BASE}/reports/2026-06-18/AAPL",
  "snapshotText": "AssetFrame Snapshot — Apple Inc. (AAPL) ...",
  "snapshotPdfUrl": "https://.../free.pdf?X-Amz-Expires=600...",
  "proAvailable": true,
  "proAccess": "Subscribe at ${BASE}/pricing to unlock the full Pro analysis.",
  "disclaimer": "AssetFrame publishes general market research ..."
}`;

const langchainSnippet = `# LangChain / MCP adapters (Python)
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "assetframe": {"transport": "streamable_http", "url": "${MCP_URL}"},
})
tools = await client.get_tools()  # list_reports, search_reports, get_report, get_track_record`;

const sub = ({ access }: { access: "free" | "signin" | "pro" }) =>
  access === "free" ? (
    <span className="ml-2 rounded-full bg-[#e3f0e3] px-2 py-0.5 text-[11px] font-semibold text-[#1f6b34]">Free · no auth</span>
  ) : access === "signin" ? (
    <span className="ml-2 rounded-full bg-[#e6eefb] px-2 py-0.5 text-[11px] font-semibold text-[#23457e]">OAuth sign-in</span>
  ) : (
    <span className="ml-2 rounded-full bg-[#fde9d6] px-2 py-0.5 text-[11px] font-semibold text-[#9a5b18]">OAuth + Pro</span>
  );

export default function McpDocsPage() {
  return (
    <>
      <Hero title="MCP server" tag="Connect Claude Code, Claude Desktop, Cursor and other agents to AssetFrame over the Model Context Protocol." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-muted-foreground">
          The Model Context Protocol (MCP) lets AI clients call tools on a server. AssetFrame runs a hosted MCP server
          over Streamable HTTP, so any MCP-capable client can read the published research. Discovery is keyless —
          listing, searching and the track record need no sign-in. Reading an individual report needs an OAuth sign-in
          (any account); the full Pro analysis additionally needs a Pro subscription.
        </p>

        <h2 className="mt-8 text-xl font-bold text-navy">Endpoint</h2>
        <CodeBlock code={MCP_URL} />

        <h2 className="mt-10 text-xl font-bold text-navy">Connect your agent</h2>

        <h3 className="mt-5 text-base font-semibold text-navy">Claude Code</h3>
        <p className="mt-1 text-sm text-muted-foreground">One command — it registers the server over HTTP transport.</p>
        <CodeBlock code={cliCmd} />

        <h3 className="mt-6 text-base font-semibold text-navy">Claude Desktop</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Settings → Developer → Edit Config, then add the server to <code>claude_desktop_config.json</code> and restart.
        </p>
        <CodeBlock code={desktopJson} />

        <h3 className="mt-6 text-base font-semibold text-navy">Cursor</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Settings → MCP → Add new server, or add to <code>~/.cursor/mcp.json</code>:
        </p>
        <CodeBlock code={cursorJson} />

        <h3 className="mt-6 text-base font-semibold text-navy">Perplexity &amp; other clients (via mcp-remote)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          For clients without a native HTTP transport, bridge through <code>mcp-remote</code>. This also drives the
          OAuth pop-up needed for the Pro tool.
        </p>
        <CodeBlock code={remoteJson} />

        <h3 className="mt-6 text-base font-semibold text-navy">ChatGPT</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          ChatGPT doesn&rsquo;t support generic MCP servers yet. Use the{" "}
          <Link href="/developers/api" className="font-semibold text-navy hover:underline">REST API with a Custom GPT Action</Link>{" "}
          and import our <a href={`${BASE}/api/v1/openapi.json`} className="font-semibold text-navy hover:underline">OpenAPI schema</a> instead.
        </p>

        <h3 className="mt-6 text-base font-semibold text-navy">LangChain / SDK clients</h3>
        <p className="mt-1 text-sm text-muted-foreground">Load the tools into any MCP-aware framework:</p>
        <CodeBlock code={langchainSnippet} />

        <h2 className="mt-10 text-xl font-bold text-navy">Tool reference</h2>
        <div className="mt-3 space-y-3">
          {TOOLS.map((t) => (
            <div key={t.name} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center">
                <code className="font-mono text-[13px] font-semibold text-navy">{t.name}</code>
                {sub({ access: t.access })}
              </div>
              <p className="mt-2 text-sm text-[#33415c]"><span className="font-semibold">Params:</span> <span className="font-mono text-[12px]">{t.params}</span></p>
              <p className="mt-1 text-sm text-[#33415c]"><span className="font-semibold">Returns:</span> {t.returns}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-bold text-navy">Sample response</h2>
        <CodeBlock code={sampleResponse} />

        <h2 className="mt-10 text-xl font-bold text-navy">Authentication (OAuth)</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Discovery — listing, searching and the track record — is keyless. Reading a report and the full Pro analysis
          both sign you in via the MCP Authorization spec: your client opens an OAuth window for your AssetFrame
          account. Any account can read Snapshots; the Pro report additionally needs a live Pro subscription.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#33415c]">
          <li>Connect to <code className="text-[12px]">{MCP_URL}</code> with an OAuth-capable client (Claude Desktop, Cursor, or any client via <code>mcp-remote</code>).</li>
          <li>
            The client discovers our OAuth endpoints from{" "}
            <code className="text-[12px]">/.well-known/oauth-protected-resource</code> and{" "}
            <code className="text-[12px]">/.well-known/oauth-authorization-server</code>. Dynamic Client Registration is enabled, so there is nothing to pre-register.
          </li>
          <li>When you call <code>get_report</code> or <code>get_pro_report</code>, the client opens a sign-in window. Sign in with your AssetFrame account (for Pro, the account that holds your subscription).</li>
          <li><code>get_report</code> returns the Snapshot; <code>get_pro_report</code> returns the full Pro text plus a short-lived Pro PDF link. Without an active subscription, <code>get_pro_report</code> returns a message pointing to <Link href="/pricing" className="font-semibold text-navy hover:underline">/pricing</Link>.</li>
        </ol>

        <AgentGuidance />

        <div className="mt-8 rounded-xl border border-[#cdd9ea] bg-tile px-4 py-3 text-sm text-[#33415c]">{SITE.disclaimer}</div>
      </div>
    </>
  );
}
