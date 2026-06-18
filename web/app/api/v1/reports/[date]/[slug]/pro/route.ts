import { getProReportDetail } from "@/lib/reports-api";
import { apiJson, apiPreflight } from "@/lib/http";
import { isValidReportRef } from "@/lib/report-key";
import { requireProApiKey } from "@/lib/api-auth";
import { rateLimitResponseWithHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/v1/reports/{date}/{slug}/pro — gated Pro analysis.
// Requires a valid API key (Bearer af_live_...) AND an active Pro subscription.
export async function GET(req: Request, ctx: { params: Promise<{ date: string; slug: string }> }) {
  // 1. Pro API-key auth (key + subscription check)
  const auth = await requireProApiKey(req);
  if (auth instanceof Response) return auth;

  // 2. Per-key rate limit (120 req/min, shared with the Snapshot endpoint)
  const rl = await rateLimitResponseWithHeaders(req, `key:${auth.clerkUserId}`, { limit: 120, windowSec: 60 });
  if (rl) return rl;

  const { date, slug } = await ctx.params;
  if (!isValidReportRef(date, slug)) {
    return apiJson({ error: "not_found", message: "No published Pro report for that date/slug." }, { status: 404 });
  }
  const data = await getProReportDetail(date, slug);
  if (!data) return apiJson({ error: "not_found", message: "No published Pro report for that date/slug." }, { status: 404 });
  return apiJson(data);
}

export function OPTIONS() {
  return apiPreflight();
}
