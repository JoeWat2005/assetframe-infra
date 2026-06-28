import { createMcpHandler, experimental_withMcpAuth } from "mcp-handler";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { listReports, getReportDetail, getProReportDetail, getTrackRecordPayload } from "@/lib/reports-api";
import { computeEntitlement, type PublicMeta } from "@/lib/access";
import { isValidReportRef } from "@/lib/report-key";
import { rateLimitResponseWithHeaders, getRequestIp } from "@/lib/rate-limit";
import { SITE } from "@/site.config";

// AssetFrame MCP server (Streamable HTTP) at /api/mcp.
//  - Keyless tools (list_reports / search_reports / get_track_record): no auth — discovery.
//  - get_report: requires Clerk OAuth sign-in (any account), mirroring the REST rule that
//    reading report content needs an account.
//  - get_pro_report: requires OAuth sign-in AND a live Pro subscription.
// The handler is wrapped with experimental_withMcpAuth({ required: false }) so the keyless
// tools keep working without a token; the gated tools enforce auth themselves in-handler.
export const maxDuration = 60;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const note = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError ? { isError: true } : {}) });

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function userIsPro(userId: string): Promise<boolean> {
  try {
    const cc = await clerkClient();
    const u = await cc.users.getUser(userId);
    const email = u.primaryEmailAddress?.emailAddress?.toLowerCase();
    return computeEntitlement((u.publicMetadata || {}) as PublicMeta, email, ADMIN_EMAILS).subscribed;
  } catch {
    return false;
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_reports",
      {
        title: "List AssetFrame reports",
        description:
          "List published AssetFrame report editions (free Snapshot metadata: instrument, directional status, risk, confidence, window). Optionally filter by asset class, status, or date.",
        inputSchema: {
          asset_class: z.string().optional().describe("e.g. 'equity', 'fx', 'crypto', 'commodity', 'index'"),
          status: z.string().optional().describe("directional status, e.g. 'Buy', 'Sell', 'Wait'"),
          date: z.string().optional().describe("ISO date YYYY-MM-DD"),
          cadence: z.string().optional().describe("generation cadence: 'daily' | 'weekly' | 'monthly'"),
          limit: z.number().int().min(1).max(200).optional().describe("max rows (default 50)"),
        },
      },
      async ({ asset_class, status, date, cadence, limit }) =>
        json(await listReports({ assetClass: asset_class, status, date, cadence, limit }))
    );

    server.registerTool(
      "search_reports",
      {
        title: "Search reports",
        description: "Search published reports by instrument name or ticker (e.g. 'BTC', 'gold', 'Apple').",
        inputSchema: {
          query: z.string().min(1).describe("instrument name or ticker"),
          limit: z.number().int().min(1).max(200).optional(),
        },
      },
      async ({ query, limit }) => json(await listReports({ query, limit }))
    );

    server.registerTool(
      "get_report",
      {
        title: "Get a report",
        description:
          "Get one report's free Snapshot: metadata, the Snapshot text, and a short-lived PDF link. Requires signing in with your AssetFrame account (OAuth) — any account works. The full Pro analysis additionally requires a subscription (see get_pro_report).",
        inputSchema: {
          date: z.string().describe("ISO date YYYY-MM-DD"),
          slug: z.string().describe("instrument slug, e.g. 'AAPL' or 'BTC'"),
        },
      },
      async ({ date, slug }, extra) => {
        const userId = extra?.authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          return note(
            "Reading a report requires signing in with your AssetFrame account (OAuth). The catalog (list_reports / search_reports) and track record stay open without sign-in.",
            true
          );
        }
        if (!isValidReportRef(date, slug)) return note("No published report found for that date/slug.", true);
        const r = await getReportDetail(date, slug);
        return r ? json(r) : note("No published report found for that date/slug.", true);
      }
    );

    server.registerTool(
      "get_track_record",
      {
        title: "Get track record",
        description:
          "AssetFrame's public track record: scored predictions, hit rate, current/longest streak, per-confidence calibration, a per-TIMEFRAME (horizon) breakdown (byHorizon) and a per-CADENCE breakdown (byCadence: daily/weekly/monthly). Optionally filter to one timeframe and/or cadence.",
        inputSchema: {
          timeframe: z.string().optional().describe("filter to a horizon: 'daily' | 'weekly' | 'hourly' (a.k.a. next_session | multi_session | intraday)"),
          cadence: z.string().optional().describe("filter to a scoring cadence: 'daily' | 'weekly' | 'monthly'"),
        },
      },
      async ({ timeframe, cadence }) => json(await getTrackRecordPayload({ horizon: timeframe, cadence }))
    );

    server.registerTool(
      "get_pro_report",
      {
        title: "Get the full Pro report",
        description:
          "The full Pro analysis text plus a short-lived Pro PDF link. Requires an authenticated AssetFrame account (OAuth) with an active Pro subscription.",
        inputSchema: {
          date: z.string().describe("ISO date YYYY-MM-DD"),
          slug: z.string().describe("instrument slug, e.g. 'AAPL' or 'BTC'"),
        },
      },
      async ({ date, slug }, extra) => {
        const userId = extra?.authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          return note("This tool requires signing in with your AssetFrame account (OAuth). Free Snapshots are available via get_report.", true);
        }
        if (!(await userIsPro(userId))) {
          return note(`Your account doesn't have an active AssetFrame Pro subscription. Subscribe at ${SITE.url}/pricing to unlock Pro reports.`, true);
        }
        if (!isValidReportRef(date, slug)) return note("No Pro report found for that date/slug.", true);
        const r = await getProReportDetail(date, slug);
        return r ? json(r) : note("No Pro report found for that date/slug.", true);
      }
    );
  },
  { serverInfo: { name: "assetframe", version: "1.0.0" } },
  { basePath: "/api", disableSse: true, verboseLogs: false }
);

// Optional OAuth: populates extra.authInfo when a valid Clerk OAuth token is present.
// required:false keeps the free tools usable without any token. Defensive try/catch so a
// Clerk/OAuth misconfiguration can never take down the free tools.
const authHandler = experimental_withMcpAuth(
  handler,
  async (_req: Request, token?: string) => {
    try {
      return verifyClerkToken(await auth({ acceptsToken: "oauth_token" }), token);
    } catch {
      return undefined;
    }
  },
  { required: false }
);

// Per-caller rate limit, mirroring the public REST API: same @upstash/ratelimit sliding
// window (lib/rate-limit) and the same 429 shape (error body + Retry-After / RateLimit-*
// headers). Keyed per OAuth bearer token when present (per-credential, the MCP analogue of
// the REST `key:` bucket), else per client IP. No-op until Upstash is configured — exactly
// like the REST routes. We hash the token so a raw credential never lands in a Redis key.
function rateLimitId(req: Request): string {
  const authz = req.headers.get("authorization") ?? "";
  if (authz.toLowerCase().startsWith("bearer ")) {
    const token = authz.slice("bearer ".length).trim();
    if (token) return `mcp:key:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
  }
  return `mcp:ip:${getRequestIp(req)}`;
}

async function rateLimitedHandler(req: Request): Promise<Response> {
  const limited = await rateLimitResponseWithHeaders(req, rateLimitId(req), { limit: 120, windowSec: 60 });
  if (limited) return limited;
  return authHandler(req);
}

export { rateLimitedHandler as GET, rateLimitedHandler as POST, rateLimitedHandler as DELETE };
