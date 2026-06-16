import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/ui";
import CodeBlock from "../CodeBlock";
import { AgentGuidance } from "../page";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "REST API",
  description: "A simple read-only JSON API for the AssetFrame report catalog, Snapshots and track record. Import the OpenAPI schema into ChatGPT Actions or LangChain.",
  alternates: { canonical: "/developers/api" },
};

const BASE = SITE.url.replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const OPENAPI = `${BASE}/api/v1/openapi.json`;

const listResponse = `// GET /api/v1/reports?asset_class=crypto&limit=5
{
  "total": 21,
  "returned": 5,
  "reports": [
    {
      "id": "2026-06-15/BTC",
      "date": "2026-06-15",
      "slug": "BTC",
      "instrument": "Bitcoin",
      "ticker": "BTC",
      "assetClass": "crypto",
      "status": "Wait",
      "risk": "High",
      "bias": "Neutral",
      "confidence": 60,
      "windowEnd": "2026-06-16T20:00:00Z",
      "hasPro": true,
      "url": "${BASE}/reports/2026-06-15/BTC"
    }
  ],
  "disclaimer": "AssetFrame publishes general market research ..."
}`;

const detailResponse = `// GET /api/v1/reports/2026-06-15/BTC
{
  "id": "2026-06-15/BTC",
  "date": "2026-06-15",
  "instrument": "Bitcoin",
  "ticker": "BTC",
  "status": "Wait",
  "risk": "High",
  "confidence": 60,
  "windowEnd": "2026-06-16T20:00:00Z",
  "snapshotText": "AssetFrame Snapshot — Bitcoin (BTC) ...",
  "snapshotPdfUrl": "https://.../free.pdf?X-Amz-Expires=600...",
  "proAvailable": true,
  "proAccess": "Subscribe at ${BASE}/pricing to unlock the full Pro analysis.",
  "disclaimer": "AssetFrame publishes general market research ..."
}
// 404 → { "error": "not_found", "message": "No published report for that date/slug." }`;

const trackResponse = `// GET /api/v1/track-record
{
  "stats": {
    "reportsScored": 18,
    "openCalls": 3,
    "predictionsGraded": 54,
    "hitRate": 61.1,
    "longestStreak": 5,
    "currentStreak": 2
  },
  "open": [ /* not-yet-graded calls with their predictions */ ],
  "scored": [ /* append-only graded calls */ ],
  "calibration": { "<=60": { "hitRate": 57.0, "n": 8 }, "61-75": { "hitRate": 64.0, "n": 7 }, ">75": { "hitRate": 80.0, "n": 3 } },
  "disclaimer": "AssetFrame publishes general market research ..."
}`;

const langchainSnippet = `# LangChain tool (Python) — wrap the read-only endpoint
import requests
from langchain_core.tools import tool

@tool
def list_assetframe_reports(asset_class: str = "", limit: int = 5) -> dict:
    """List AssetFrame report editions (free Snapshot metadata)."""
    r = requests.get("${API}/reports",
                     params={"asset_class": asset_class or None, "limit": limit},
                     timeout=20)
    r.raise_for_status()
    return r.json()`;

export default function ApiDocsPage() {
  return (
    <>
      <Hero title="REST API" tag="A simple read-only JSON API for the report catalog, Snapshots and the track record." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-muted-foreground">
          Read-only JSON over HTTPS. No key required for the free tier, and responses include CORS headers so you can
          call it from the browser. Every payload carries the research disclaimer. The paid Pro analysis is not exposed
          here — it&rsquo;s available to subscribers over <Link href="/developers/mcp" className="font-semibold text-navy hover:underline">MCP</Link>.
        </p>

        <h2 className="mt-8 text-xl font-bold text-navy">Base URL</h2>
        <CodeBlock code={API} />
        <p className="mt-3 text-sm text-muted-foreground">
          Machine-readable schema (OpenAPI 3.1):{" "}
          <a href={OPENAPI} className="font-semibold text-navy hover:underline">{OPENAPI}</a>
        </p>

        <h2 className="mt-10 text-xl font-bold text-navy">Use it from your agent</h2>

        <h3 className="mt-5 text-base font-semibold text-navy">ChatGPT — Custom GPT Action</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a Custom GPT → Configure → Actions → Import from URL, and paste the OpenAPI URL. No auth is required
          (the free tier is public). The three operations (<code>listReports</code>, <code>getReport</code>,{" "}
          <code>getTrackRecord</code>) become callable Actions.
        </p>
        <CodeBlock code={OPENAPI} label="Import this URL" />

        <h3 className="mt-6 text-base font-semibold text-navy">Perplexity &amp; generic HTTP (curl)</h3>
        <p className="mt-1 text-sm text-muted-foreground">Any client that can make an HTTPS GET can use it directly:</p>
        <CodeBlock code={`curl "${API}/reports?asset_class=crypto&limit=5"`} />

        <h3 className="mt-6 text-base font-semibold text-navy">LangChain / Python</h3>
        <p className="mt-1 text-sm text-muted-foreground">Wrap an endpoint as a tool:</p>
        <CodeBlock code={langchainSnippet} />

        <h2 className="mt-10 text-xl font-bold text-navy">Endpoints</h2>

        <h3 className="mt-5 font-mono text-sm font-semibold text-navy">GET /reports</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          List published editions. Query params: <code>asset_class</code>, <code>status</code>, <code>date</code> (YYYY-MM-DD), <code>q</code> (search), <code>limit</code> (1–200, default 50).
        </p>
        <CodeBlock code={`curl "${API}/reports?asset_class=crypto&limit=5"`} />
        <CodeBlock code={listResponse} label="Response" />

        <h3 className="mt-6 font-mono text-sm font-semibold text-navy">GET /reports/{`{date}`}/{`{slug}`}</h3>
        <p className="mt-1 text-sm text-muted-foreground">One report: Snapshot metadata, Snapshot text and a short-lived PDF link. Returns 404 if not found.</p>
        <CodeBlock code={`curl "${API}/reports/2026-06-15/BTC"`} />
        <CodeBlock code={detailResponse} label="Response" />

        <h3 className="mt-6 font-mono text-sm font-semibold text-navy">GET /track-record</h3>
        <p className="mt-1 text-sm text-muted-foreground">Aggregate stats, open (not-yet-graded) calls, scored results and per-confidence calibration.</p>
        <CodeBlock code={`curl "${API}/track-record"`} />
        <CodeBlock code={trackResponse} label="Response" />

        <AgentGuidance />

        <div className="mt-8 rounded-xl border border-[#cdd9ea] bg-tile px-4 py-3 text-sm text-[#33415c]">
          Responses are cached briefly at the edge. This is research data — not a trading or execution API.
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{SITE.disclaimer}</p>
      </div>
    </>
  );
}
