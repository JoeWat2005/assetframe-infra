import { SITE } from "@/site.config";

// OpenAPI 3.1 description of the REST API (/api/v1/*). Served so that agent platforms
// which speak OpenAPI — ChatGPT Actions, LangChain tool loaders, generic HTTP clients
// — can import the schema directly from <SITE.url>/api/v1/openapi.json.
//
// Access model:
//  - GET /api/v1/reports          → PUBLIC (no key). Per-IP rate limit.
//  - GET /api/v1/track-record     → PUBLIC (no key). Per-IP rate limit.
//  - GET /api/v1/reports/{date}/{slug}      → API key required (Bearer af_live_...).
//  - GET /api/v1/reports/{date}/{slug}/pro  → API key + Pro subscription required.
//
// The document is deterministic per deployment, so we prerender with `force-static`.
export const dynamic = "force-static";

const BASE = SITE.url.replace(/\/$/, "");

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function buildOpenApi() {
  const reportSummary = {
    type: "object",
    properties: {
      id: { type: "string", description: "Stable edition id, '{date}/{slug}'.", examples: ["2026-06-15/BTC"] },
      date: { type: "string", format: "date", examples: ["2026-06-15"] },
      slug: { type: "string", examples: ["BTC"] },
      instrument: { type: "string", examples: ["Bitcoin"] },
      ticker: { type: "string", examples: ["BTC"] },
      assetClass: { type: "string", examples: ["Crypto - major", "US equity", "FX - major", "Commodity - metals", "Equity index future"] },
      assetClassKey: { type: "string", description: "Normalised asset-class key.", examples: ["crypto", "equity", "fx", "commodity", "index"] },
      status: { type: "string", description: "Directional status (decision-support label, not an order).", examples: ["Buy", "Sell", "Wait"] },
      risk: { type: "string", examples: ["Low", "Medium", "High"] },
      bias: { type: "string", examples: ["Bullish", "Bearish", "Neutral"] },
      confidence: { type: ["integer", "null"], description: "Calibrated 0–100 confidence, scored after the fact. Not a guarantee or a trade signal.", examples: [60] },
      windowEnd: { type: "string", description: "Human-readable end of the prediction window (report timezone) the call is graded against.", examples: ["Thu 18 Jun 2026 22:00 UK"] },
      hasPro: { type: "boolean", description: "Whether a paid Pro edition also exists for this report." },
      url: { type: "string", format: "uri", examples: [`${BASE}/reports/2026-06-15/BTC`] },
    },
    required: ["id", "date", "slug", "instrument", "ticker", "assetClass", "assetClassKey", "status", "risk", "bias", "confidence", "windowEnd", "hasPro", "url"],
  };

  const errorSchema = {
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
    required: ["error", "message"],
  };

  const resp401 = {
    description: "Missing or invalid API key.",
    content: { "application/json": { schema: errorSchema } },
  };
  const resp403 = {
    description: "Valid API key but no active Pro subscription.",
    content: { "application/json": { schema: errorSchema } },
  };
  const resp404 = {
    description: "No published report for that date/slug.",
    content: { "application/json": { schema: errorSchema } },
  };
  const resp429 = {
    description: "Rate limit exceeded.",
    content: { "application/json": { schema: errorSchema } },
    headers: {
      "Retry-After": { schema: { type: "integer" }, description: "Seconds until the limit resets." },
      "RateLimit-Limit": { schema: { type: "integer" } },
      "RateLimit-Remaining": { schema: { type: "integer" } },
      "RateLimit-Reset": { schema: { type: "integer" }, description: "Unix epoch seconds." },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "AssetFrame REST API",
      version: "1.0.0",
      description:
        "JSON API for the AssetFrame report catalog, individual Snapshots, Pro analysis, and the public track record.\n\n" +
        "**Access model:**\n" +
        "- `GET /api/v1/reports` and `GET /api/v1/track-record` are **public** — no API key needed, per-IP rate limited.\n" +
        "- `GET /api/v1/reports/{date}/{slug}` (free Snapshot content) requires an **API key** (`Authorization: Bearer af_live_...`).\n" +
        "- `GET /api/v1/reports/{date}/{slug}/pro` (full Pro analysis) requires an **API key** AND an active **Pro subscription**.\n\n" +
        "To obtain an API key, sign in at " + BASE + " and generate one from your account settings.\n\n" +
        SITE.disclaimer,
      contact: { name: "AssetFrame", email: SITE.contactEmail, url: BASE },
    },
    servers: [{ url: BASE, description: "AssetFrame" }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "AssetFrame API key (af_live_...)",
        },
      },
    },
    paths: {
      "/api/v1/reports": {
        get: {
          operationId: "listReports",
          summary: "List published report editions",
          description:
            "List published editions as free Snapshot metadata (instrument, directional status, risk, calibrated confidence, window). Optionally filter by asset class, status, date, or a free-text query. **No API key required.**",
          parameters: [
            { name: "asset_class", in: "query", required: false, description: "Filter by asset class — accepts a short key (crypto|fx|equity|index|commodity) or the exact display label.", schema: { type: "string", examples: ["crypto", "equity", "fx", "commodity", "index"] } },
            { name: "status", in: "query", required: false, description: "Filter by directional status.", schema: { type: "string", examples: ["Buy", "Sell", "Wait"] } },
            { name: "date", in: "query", required: false, description: "Filter to a single ISO date (YYYY-MM-DD).", schema: { type: "string", format: "date" } },
            { name: "q", in: "query", required: false, description: "Free-text search over instrument name and ticker.", schema: { type: "string", examples: ["bitcoin", "gold"] } },
            { name: "limit", in: "query", required: false, description: "Max rows to return (1–200, default 50).", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
          ],
          responses: {
            "200": {
              description: "A page of report summaries.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer", description: "Total editions matching the filter, before limit." },
                      returned: { type: "integer", description: "Number of editions in this response." },
                      reports: { type: "array", items: reportSummary },
                      disclaimer: { type: "string" },
                    },
                    required: ["total", "returned", "reports", "disclaimer"],
                  },
                },
              },
            },
            "429": resp429,
          },
        },
      },
      "/api/v1/reports/{date}/{slug}": {
        get: {
          operationId: "getReport",
          summary: "Get one report's free Snapshot",
          description:
            "Return one report's free Snapshot: metadata, the Snapshot text, and a short-lived signed PDF link (~10 minutes). **Requires an API key.** The full Pro analysis is at the `/pro` sub-resource.",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: "date", in: "path", required: true, description: "ISO date (YYYY-MM-DD).", schema: { type: "string", format: "date" } },
            { name: "slug", in: "path", required: true, description: "Instrument slug, e.g. 'BTC' or 'AAPL'.", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "The free Snapshot for the requested edition.",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      reportSummary,
                      {
                        type: "object",
                        properties: {
                          snapshotText: { type: "string", description: "Plain-text rendering of the one-page Snapshot." },
                          snapshotPdfUrl: { type: ["string", "null"], format: "uri", description: "Short-lived signed PDF link (~600s), or null." },
                          proAvailable: { type: "boolean" },
                          proAccess: { type: ["string", "null"], description: "How to unlock Pro, when a Pro edition exists." },
                          disclaimer: { type: "string" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "401": resp401,
            "404": resp404,
            "429": resp429,
          },
        },
      },
      "/api/v1/reports/{date}/{slug}/pro": {
        get: {
          operationId: "getProReport",
          summary: "Get the full Pro analysis for one report",
          description:
            "Return the full Pro analysis: metadata, Pro text, and a short-lived signed Pro PDF link (~10 minutes). **Requires an API key AND an active Pro subscription.**",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: "date", in: "path", required: true, description: "ISO date (YYYY-MM-DD).", schema: { type: "string", format: "date" } },
            { name: "slug", in: "path", required: true, description: "Instrument slug, e.g. 'BTC' or 'AAPL'.", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "The full Pro analysis for the requested edition.",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      reportSummary,
                      {
                        type: "object",
                        properties: {
                          proText: { type: "string", description: "Plain-text rendering of the Pro analysis." },
                          proPdfUrl: { type: ["string", "null"], format: "uri", description: "Short-lived signed Pro PDF link (~600s), or null." },
                          disclaimer: { type: "string" },
                        },
                        required: ["proText", "proPdfUrl", "disclaimer"],
                      },
                    ],
                  },
                },
              },
            },
            "401": resp401,
            "403": resp403,
            "404": resp404,
            "429": resp429,
          },
        },
      },
      "/api/v1/track-record": {
        get: {
          operationId: "getTrackRecord",
          summary: "Get the public track record",
          description:
            "Return the public, append-only track record: aggregate stats (reports scored, open calls, predictions graded, hit rate, streaks), the open (not-yet-graded) calls, the scored results, and per-confidence calibration. **No API key required.**",
          responses: {
            "200": {
              description: "Track-record stats, open calls, scored results and calibration.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      stats: {
                        type: "object",
                        properties: {
                          reportsScored: { type: "integer" },
                          openCalls: { type: "integer" },
                          predictionsGraded: { type: "integer" },
                          hitRate: { type: ["number", "null"], description: "Overall hit rate (%), or null if nothing graded yet." },
                          longestStreak: { type: "integer" },
                          currentStreak: { type: "integer" },
                        },
                        required: ["reportsScored", "openCalls", "predictionsGraded", "hitRate", "longestStreak", "currentStreak"],
                      },
                      open: {
                        type: "array",
                        description: "Calls whose window has not closed yet (not graded).",
                        items: {
                          type: "object",
                          properties: {
                            reportId: { type: "string", examples: ["AF-20260615-BTC"] },
                            instrument: { type: "string" },
                            symbol: { type: "string" },
                            view: { type: "string" },
                            confidence: { type: ["number", "null"] },
                            windowEnd: { type: "string" },
                            n: { type: "integer", description: "Number of falsifiable predictions in the call." },
                            nManual: { type: "integer" },
                            hits: { type: "integer" },
                            scored: { type: "boolean" },
                            predictions: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  id: { type: "string" },
                                  type: { type: "string" },
                                  text: { type: "string" },
                                  manual: { type: "boolean" },
                                  expect: { type: ["boolean", "null"] },
                                },
                              },
                            },
                          },
                        },
                      },
                      scored: {
                        type: "array",
                        description: "Graded calls (each row is append-only and never edited).",
                        items: {
                          type: "object",
                          properties: {
                            instrument: { type: "string" },
                            view: { type: "string" },
                            confidence: { type: ["number", "null"] },
                            results: { type: "string", description: "Per-prediction Hit/Miss/No-trigger summary." },
                            hitRate: { type: ["string", "number"] },
                            windowEnd: { type: "string" },
                          },
                        },
                      },
                      calibration: {
                        type: ["object", "null"],
                        description: "Hit rate vs stated confidence, bucketed; null until enough calls are graded.",
                        additionalProperties: {
                          type: "object",
                          properties: { hitRate: { type: ["number", "null"] }, n: { type: "integer" } },
                        },
                      },
                      disclaimer: { type: "string" },
                    },
                    required: ["stats", "open", "scored", "calibration", "disclaimer"],
                  },
                },
              },
            },
            "429": resp429,
          },
        },
      },
    },
  };
}

export async function GET() {
  return new Response(JSON.stringify(buildOpenApi(), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      ...CORS,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
