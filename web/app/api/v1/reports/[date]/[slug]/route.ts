import { getReportDetail } from "@/lib/reports-api";
import { apiJson, apiPreflight } from "@/lib/http";
import { isValidReportRef } from "@/lib/report-key";
import { requireApiKey } from "@/lib/api-auth";
import { rateLimitResponseWithHeaders, getRequestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/v1/reports/{date}/{slug} — free Snapshot detail (metadata + text + short-lived PDF link).
// Requires a valid API key (Bearer af_live_...). Pro content is at the /pro sub-resource.
export async function GET(req: Request, ctx: { params: Promise<{ date: string; slug: string }> }) {
  // 1. API-key auth
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;

  // 2. Per-key rate limit (120 req/min)
  const rl = await rateLimitResponseWithHeaders(req, `key:${auth.clerkUserId}`, { limit: 120, windowSec: 60 });
  if (rl) return rl;

  const { date, slug } = await ctx.params;
  // Reject malformed date/slug before touching the data layer.
  if (!isValidReportRef(date, slug)) {
    return apiJson({ error: "not_found", message: "No published report for that date/slug." }, { status: 404 });
  }
  const data = await getReportDetail(date, slug);
  if (!data) return apiJson({ error: "not_found", message: "No published report for that date/slug." }, { status: 404 });
  return apiJson(data);
}

export function OPTIONS() {
  return apiPreflight();
}
