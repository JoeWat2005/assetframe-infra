import type { Metadata } from "next";
import Link from "next/link";
import { Terminal, Code2, FileJson, ArrowRight } from "lucide-react";
import { Hero } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "Developers",
  description: "Bring AssetFrame research into your tools and agents — over MCP or a simple read-only REST API.",
  alternates: { canonical: "/developers" },
};

const BASE = SITE.url.replace(/\/$/, "");

const CARDS = [
  { href: "/developers/mcp", icon: Terminal, title: "MCP server", desc: "Connect Claude Code, Claude Desktop, Cursor and other agents to AssetFrame over the Model Context Protocol — five read-only tools, four of them keyless." },
  { href: "/developers/api", icon: Code2, title: "REST API", desc: "A read-only JSON API for the report catalog, individual Snapshots and the track record. No key, CORS-open, every payload carries the disclaimer." },
  { href: `${BASE}/api/v1/openapi.json`, icon: FileJson, title: "OpenAPI schema", desc: "Import the OpenAPI 3.1 document straight into ChatGPT Actions, LangChain or any client that speaks OpenAPI.", external: true },
];

// Agent-behaviour guidance — authoritative rules for any model or agent that surfaces
// AssetFrame output. Exported so /developers/mcp and /developers/api can render the same block.
export function AgentGuidance() {
  return (
    <section id="agent-guidance" className="mt-10 scroll-mt-24" data-animate="up">
      <h2 className="text-xl font-bold text-navy">Guidance for agents</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        If you are an AI agent presenting AssetFrame data to a user, follow these four rules.
      </p>
      <dl className="mt-4 space-y-4">
        <div className="rounded-xl border border-line bg-tile px-4 py-3">
          <dt className="text-sm font-semibold text-navy">Cite the source</dt>
          <dd className="mt-1 text-sm text-[#33415c]">
            Attribute figures to AssetFrame, name the instrument and the report date, and link the edition
            (<code className="text-[13px]">{`${BASE}/reports/{date}/{slug}`}</code>). Snapshot text and PDF links are the published record — quote them, don&rsquo;t paraphrase numbers into new claims.
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-tile px-4 py-3">
          <dt className="text-sm font-semibold text-navy">Treat confidence as calibrated, not a promise</dt>
          <dd className="mt-1 text-sm text-[#33415c]">
            The <code className="text-[13px]">confidence</code> value (0–100) is a calibrated estimate that is scored against the
            tape after the window closes. It is <strong>not</strong> a guarantee, a probability of profit, or a trade signal.
            Present it alongside the risk rating and the prediction window, never on its own.
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-tile px-4 py-3">
          <dt className="text-sm font-semibold text-navy">Explain the ledger honestly</dt>
          <dd className="mt-1 text-sm text-[#33415c]">
            Every call registers falsifiable predictions before the session and is graded Hit / Miss / No-trigger
            afterwards. The ledger is append-only — rows are never edited or deleted — so the hit rate, streaks and
            calibration from <code className="text-[13px]">/track-record</code> can be verified rather than taken on trust.
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-tile px-4 py-3">
          <dt className="text-sm font-semibold text-navy">Avoid investment-advice language</dt>
          <dd className="mt-1 text-sm text-[#33415c]">
            This is general market research and decision support, not regulated advice or a personal recommendation.
            Don&rsquo;t tell the user to buy or sell, don&rsquo;t imply guaranteed returns, and surface the disclaimer
            that ships in every payload.
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <>
      <Hero title="Developers" tag="Bring AssetFrame research into your tools and agents — over MCP or a simple REST API." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-muted-foreground" data-animate="up">
          Everything we publish can be read programmatically. The free tier covers the full report catalog, each free
          Snapshot and the public track record — no key required. Only the paid Pro analysis sits behind a subscription
          (and, over MCP, an OAuth sign-in).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2" data-animate="up">
          {CARDS.map((c) => (
            <Card key={c.href}>
              <CardContent className="flex h-full flex-col gap-2">
                <c.icon className="size-6 text-navy" aria-hidden="true" />
                <h2 className="text-lg font-bold text-navy">{c.title}</h2>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
                {c.external ? (
                  <a href={c.href} className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-navy hover:underline">
                    View schema <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                ) : (
                  <Link href={c.href} className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-navy hover:underline">
                    Read the guide <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-[#cdd9ea] bg-tile px-4 py-3 text-sm text-[#33415c]" data-animate="up">
          What you can access: the report catalog (instrument, directional status, risk, confidence, window),
          each free Snapshot (text plus a short-lived PDF link), and the public track record (hit rate, streaks,
          calibration).
        </div>

        <AgentGuidance />

        <p className="mt-8 text-xs text-muted-foreground" data-animate="up">{SITE.disclaimer}</p>
      </div>
    </>
  );
}
