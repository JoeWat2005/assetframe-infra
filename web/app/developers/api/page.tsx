import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/ui";
import CodeBlock from "../CodeBlock";
import { AgentGuidance } from "../page";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "REST API",
  description:
    "Read-only JSON API for the AssetFrame report catalog, Snapshots, Pro analysis and track record. Public discovery endpoints plus API-key access to report content. Import the OpenAPI 3.1 schema into ChatGPT Actions, LangChain or any HTTP client.",
  alternates: { canonical: "/developers/api" },
};

const BASE = SITE.url.replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const OPENAPI = `${BASE}/api/v1/openapi.json`;

// Endpoint paths kept as plain strings so the `{date}`/`{slug}` braces don't collide with JSX.
const EP = {
  list: "/api/v1/reports",
  detail: "/api/v1/reports/{date}/{slug}",
  pro: "/api/v1/reports/{date}/{slug}/pro",
  track: "/api/v1/track-record",
  openapi: "/api/v1/openapi.json",
};

const listResponse = `// GET /api/v1/reports?asset_class=crypto&limit=2
{
  "total": 21,
  "returned": 2,
  "reports": [
    {
      "id": "2026-06-18/BTC",
      "date": "2026-06-18",
      "slug": "BTC",
      "instrument": "Bitcoin",
      "ticker": "BTC",
      "assetClass": "Crypto - major",
      "assetClassKey": "crypto",
      "status": "Wait",
      "risk": "High",
      "bias": "Neutral",
      "confidence": 55,
      "windowEnd": "Fri 19 Jun 2026 22:00 UK",
      "hasPro": true,
      "url": "${BASE}/reports/2026-06-18/BTC"
    }
  ],
  "disclaimer": "AssetFrame publishes general market research ..."
}`;

const detailResponse = `// GET /api/v1/reports/2026-06-18/AAPL
// Header: Authorization: Bearer af_live_...
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
  "snapshotPdfUrl": "https://...r2.../free.pdf?X-Amz-Expires=600&...",
  "proAvailable": true,
  "proAccess": "Subscribe at ${BASE}/pricing to unlock the full Pro analysis.",
  "disclaimer": "AssetFrame publishes general market research ..."
}
// 401 → { "error": "unauthorized", "message": "Provide a valid API key: Authorization: Bearer af_live_..." }
// 404 → { "error": "not_found", "message": "No published report for that date/slug." }`;

const proResponse = `// GET /api/v1/reports/2026-06-18/AAPL/pro
// Header: Authorization: Bearer af_live_...   (key must belong to a Pro account)
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
  "proText": "Apple Inc. (AAPL) — AssetFrame Pro ... (full multi-page analysis)",
  "proPdfUrl": "https://...r2.../pro.pdf?X-Amz-Expires=600&...",
  "disclaimer": "AssetFrame publishes general market research ..."
}
// 401 → { "error": "unauthorized", "message": "Provide a valid API key ..." }
// 403 → { "error": "forbidden", "message": "A Pro subscription is required. Subscribe at ${BASE}/pricing." }`;

const trackResponse = `// GET /api/v1/track-record
{
  "stats": {
    "reportsScored": 18,
    "openCalls": 8,
    "predictionsGraded": 54,
    "hitRate": 61.1,
    "longestStreak": 5,
    "currentStreak": 2
  },
  "open": [ /* not-yet-graded calls, each with its predictions[] */ ],
  "scored": [ /* append-only graded calls with per-prediction results */ ],
  "calibration": {
    "<=60": { "hitRate": 57.0, "n": 8 },
    "61-75": { "hitRate": 64.0, "n": 7 },
    ">75": { "hitRate": 80.0, "n": 3 }
  },
  "disclaimer": "AssetFrame publishes general market research ..."
}`;

const errorShape = `// Every error shares the same shape:
{ "error": "<code>", "message": "<human-readable detail>" }

// 401  unauthorized        Missing, malformed, revoked or unknown API key (gated endpoints).
// 403  forbidden           Valid key, but the account has no active Pro subscription (/pro only).
// 404  not_found           No published report for that date/slug.
// 429  too_many_requests   Rate limit exceeded — see Retry-After + RateLimit-Reset headers.`;

const authHeader = `Authorization: Bearer af_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;

const curlList = `curl "${API}/reports?asset_class=crypto&limit=5"`;
const curlDetail = `# Free Snapshot content — any valid key
curl -H "Authorization: Bearer $ASSETFRAME_KEY" \\
  "${API}/reports/2026-06-18/AAPL"`;
const curlPro = `# Full Pro analysis — key must belong to a Pro account
curl -H "Authorization: Bearer $ASSETFRAME_KEY" \\
  "${API}/reports/2026-06-18/AAPL/pro"`;
const curlTrack = `curl "${API}/track-record"`;
const curlOpenapi = `curl "${OPENAPI}"`;

const langchainSnippet = `# LangChain tools (Python) — public discovery + authenticated content
import os, requests
from langchain_core.tools import tool

BASE = "${API}"
KEY = os.environ["ASSETFRAME_KEY"]            # af_live_... from your account page
AUTH = {"Authorization": f"Bearer {KEY}"}

@tool
def list_assetframe_reports(asset_class: str = "", limit: int = 5) -> dict:
    """List AssetFrame editions (public — no key needed)."""
    r = requests.get(f"{BASE}/reports",
                     params={"asset_class": asset_class or None, "limit": limit}, timeout=20)
    r.raise_for_status()
    return r.json()

@tool
def get_assetframe_report(date: str, slug: str) -> dict:
    """Fetch one report's free Snapshot (requires an API key)."""
    r = requests.get(f"{BASE}/reports/{date}/{slug}", headers=AUTH, timeout=20)
    r.raise_for_status()
    return r.json()`;

function Access({ tone, children }: { tone: "public" | "key" | "pro"; children: string }) {
  const styles: Record<string, string> = {
    public: "border-[#bfe3cf] bg-[#e7f5ee] text-[#1a7f4b]",
    key: "border-[#cdd9ea] bg-[#eef2fb] text-navy",
    pro: "border-[#f0d3ac] bg-[#fdf0e3] text-[#a4560f]",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

export default function ApiDocsPage() {
  return (
    <>
      <Hero title="REST API" tag="Read-only JSON for the report catalog, Snapshots, Pro analysis and track record." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-muted-foreground">
          A read-only JSON API over HTTPS with permissive CORS, so you can call it from a server, an agent or the
          browser. Every payload carries the standing research disclaimer. There are five endpoints in three access
          tiers: the <strong>catalog</strong> and <strong>track record</strong> are public, individual{" "}
          <strong>report content</strong> needs a free API key, and the full <strong>Pro analysis</strong> needs a key
          on a Pro account. The same data is also available to agents over{" "}
          <Link href="/developers/mcp" className="font-semibold text-navy hover:underline">MCP</Link>.
        </p>

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Access tiers at a glance</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[#cdd9ea]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-tile text-left text-navy">
                <th className="px-4 py-2.5 font-semibold">Endpoint</th>
                <th className="px-4 py-2.5 font-semibold">Access</th>
                <th className="px-4 py-2.5 font-semibold">Returns</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-[#e6ecf5]">
                <td className="px-4 py-2.5 font-mono text-xs">GET {EP.list}</td>
                <td className="px-4 py-2.5"><Access tone="public">Public</Access></td>
                <td className="px-4 py-2.5">Catalog of editions</td>
              </tr>
              <tr className="border-t border-[#e6ecf5]">
                <td className="px-4 py-2.5 font-mono text-xs">GET {EP.detail}</td>
                <td className="px-4 py-2.5"><Access tone="key">API key</Access></td>
                <td className="px-4 py-2.5">One Snapshot + PDF link</td>
              </tr>
              <tr className="border-t border-[#e6ecf5]">
                <td className="px-4 py-2.5 font-mono text-xs">GET {EP.pro}</td>
                <td className="px-4 py-2.5"><Access tone="pro">Key + Pro</Access></td>
                <td className="px-4 py-2.5">Full Pro analysis + PDF</td>
              </tr>
              <tr className="border-t border-[#e6ecf5]">
                <td className="px-4 py-2.5 font-mono text-xs">GET {EP.track}</td>
                <td className="px-4 py-2.5"><Access tone="public">Public</Access></td>
                <td className="px-4 py-2.5">Ledger stats + calibration</td>
              </tr>
              <tr className="border-t border-[#e6ecf5]">
                <td className="px-4 py-2.5 font-mono text-xs">GET {EP.openapi}</td>
                <td className="px-4 py-2.5"><Access tone="public">Public</Access></td>
                <td className="px-4 py-2.5">OpenAPI 3.1 schema</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Authentication</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Report-content endpoints are authenticated with a bearer API key. The key is an{" "}
          <strong>identity token</strong> tied to your account — it carries no tier itself. Send it on every gated
          request:
        </p>
        <CodeBlock code={authHeader} label="Header" />

        <h3 className="mt-5 text-base font-semibold text-navy">Get your key</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Sign in at <a href={BASE} className="font-semibold text-navy hover:underline">{BASE.replace(/^https?:\/\//, "")}</a> (an account is required — the same one you use to read reports).</li>
          <li>Open the{" "}
            <Link href="/account" className="font-semibold text-navy hover:underline">Account page</Link>{" "}
            → <strong>API access</strong> → <strong>Generate key</strong>.</li>
          <li>Copy the key — it&rsquo;s shown <strong>once</strong> and stored only as a hash. You hold exactly{" "}
            <strong>one key at a time</strong>; <strong>Regenerate</strong> revokes the old one and issues a new one instantly.</li>
        </ol>

        <h3 className="mt-5 text-base font-semibold text-navy">How free vs Pro is decided</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          On each request the key is resolved to its owning account. Free-content endpoints accept{" "}
          <em>any</em> valid key. The <code>/pro</code> endpoint additionally checks that account for an active Pro
          subscription (admins included) — if it isn&rsquo;t entitled you get <code>403</code>. Because the check is
          per-request against the account, upgrading or cancelling takes effect immediately on the{" "}
          <em>same</em> key — there&rsquo;s nothing to reissue.
        </p>
        <CodeBlock code={curlPro} label="Example — fetch a Pro report" />

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Base URL &amp; schema</h2>
        <CodeBlock code={API} />
        <p className="mt-3 text-sm text-muted-foreground">
          Machine-readable schema (OpenAPI 3.1), importable directly into agent platforms:{" "}
          <a href={OPENAPI} className="font-semibold text-navy hover:underline">{OPENAPI}</a>
        </p>

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Rate limits</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>120 requests per minute</strong> — keyed per IP on the public endpoints and per API key on the
          authenticated ones. When you exceed it you get <code>429 too_many_requests</code> with these headers:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li><code>Retry-After</code> — seconds until you may retry</li>
          <li><code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>, <code>RateLimit-Reset</code> (Unix epoch seconds)</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Responses are also cached briefly at the edge. Need a higher limit for a documented use case?{" "}
          <Link href="/contact" className="font-semibold text-navy hover:underline">Get in touch</Link>.
        </p>

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Errors</h2>
        <CodeBlock code={errorShape} label="Error responses" />

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Endpoints</h2>

        {/* GET /reports */}
        <h3 className="mt-6 font-mono text-sm font-semibold text-navy">GET {EP.list}</h3>
        <p className="mt-1"><Access tone="public">Public — no key</Access></p>
        <p className="mt-2 text-sm text-muted-foreground">
          List published editions as free Snapshot metadata. All query params are optional:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li><code>asset_class</code> — short key (<code>crypto</code>, <code>fx</code>, <code>equity</code>, <code>index</code>, <code>commodity</code>, <code>rates</code>) or the exact display label</li>
          <li><code>status</code> — directional status (<code>Buy</code>, <code>Sell</code>, <code>Wait</code>)</li>
          <li><code>date</code> — single ISO date (<code>YYYY-MM-DD</code>)</li>
          <li><code>q</code> — free-text search over instrument name and ticker</li>
          <li><code>limit</code> — 1–200 (default 50)</li>
        </ul>
        <CodeBlock code={curlList} />
        <CodeBlock code={listResponse} label="Response" />

        {/* GET /reports/{date}/{slug} */}
        <h3 className="mt-8 font-mono text-sm font-semibold text-navy">GET {EP.detail}</h3>
        <p className="mt-1"><Access tone="key">API key — any account</Access></p>
        <p className="mt-2 text-sm text-muted-foreground">
          One report&rsquo;s free Snapshot: full metadata, the Snapshot text, and a short-lived signed PDF link
          (~10 minutes). Path params: <code>date</code> (<code>YYYY-MM-DD</code>) and <code>slug</code> (e.g.{" "}
          <code>BTC</code>, <code>AAPL</code>). The Pro analysis lives at the <code>/pro</code> sub-resource below.
        </p>
        <CodeBlock code={curlDetail} />
        <CodeBlock code={detailResponse} label="Response" />

        {/* GET /reports/{date}/{slug}/pro */}
        <h3 className="mt-8 font-mono text-sm font-semibold text-navy">GET {EP.pro}</h3>
        <p className="mt-1"><Access tone="pro">API key + active Pro subscription</Access></p>
        <p className="mt-2 text-sm text-muted-foreground">
          The full Pro analysis: metadata, the complete Pro text, and a short-lived signed Pro PDF link
          (~10 minutes). Returns <code>401</code> without a valid key and <code>403</code> if the key&rsquo;s account
          isn&rsquo;t a Pro subscriber.
        </p>
        <CodeBlock code={curlPro} />
        <CodeBlock code={proResponse} label="Response" />

        {/* GET /track-record */}
        <h3 className="mt-8 font-mono text-sm font-semibold text-navy">GET {EP.track}</h3>
        <p className="mt-1"><Access tone="public">Public — no key</Access></p>
        <p className="mt-2 text-sm text-muted-foreground">
          The public, append-only track record: aggregate stats (reports scored, open calls, predictions graded, hit
          rate, streaks), the open (not-yet-graded) calls with their predictions, the scored results, and
          per-confidence calibration buckets.
        </p>
        <CodeBlock code={curlTrack} />
        <CodeBlock code={trackResponse} label="Response" />

        {/* GET /openapi.json */}
        <h3 className="mt-8 font-mono text-sm font-semibold text-navy">GET {EP.openapi}</h3>
        <p className="mt-1"><Access tone="public">Public — no key</Access></p>
        <p className="mt-2 text-sm text-muted-foreground">
          The full OpenAPI 3.1 description of this API — paths, schemas, the <code>ApiKeyAuth</code> bearer scheme and
          error responses. Import it into ChatGPT Actions, LangChain or any OpenAPI client.
        </p>
        <CodeBlock code={curlOpenapi} />

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-bold text-navy">Use it from your agent</h2>

        <h3 className="mt-5 text-base font-semibold text-navy">ChatGPT — Custom GPT Action</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a Custom GPT → Configure → Actions → Import from URL, and paste the OpenAPI URL. The public operations
          (<code>listReports</code>, <code>getTrackRecord</code>) work with no auth. To fetch report content, set the
          Action&rsquo;s Authentication to <strong>API Key → Bearer</strong> and paste your <code>af_live_...</code> key —
          then <code>getReport</code> and <code>getProReport</code> become callable too.
        </p>
        <CodeBlock code={OPENAPI} label="Import this URL" />

        <h3 className="mt-6 text-base font-semibold text-navy">Perplexity &amp; generic HTTP (curl)</h3>
        <p className="mt-1 text-sm text-muted-foreground">Any client that can make an HTTPS GET can use it directly:</p>
        <CodeBlock code={`${curlList}\n\n${curlDetail}`} />

        <h3 className="mt-6 text-base font-semibold text-navy">LangChain / Python</h3>
        <p className="mt-1 text-sm text-muted-foreground">Wrap the public and authenticated endpoints as tools:</p>
        <CodeBlock code={langchainSnippet} />

        <AgentGuidance />

        <div className="mt-8 rounded-xl border border-[#cdd9ea] bg-tile px-4 py-3 text-sm text-[#33415c]">
          Responses are cached briefly at the edge. This is research data — not a trading or execution API.
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{SITE.disclaimer}</p>
      </div>
    </>
  );
}
