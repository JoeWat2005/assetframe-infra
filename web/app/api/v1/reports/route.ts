import { listReports } from "@/lib/reports-api";
import { apiJson, apiPreflight } from "@/lib/http";
import { rateLimitResponseWithHeaders, getRequestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/v1/reports?asset_class=&status=&date=&q=&limit= — PUBLIC (no key required).
// Per-IP rate limit: 120 req/min.
export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitResponseWithHeaders(req, `ip:${ip}`, { limit: 120, windowSec: 60 });
  if (rl) return rl;

  const sp = new URL(req.url).searchParams;
  const limitRaw = Number(sp.get("limit"));
  const data = await listReports({
    assetClass: sp.get("asset_class") || undefined,
    status: sp.get("status") || undefined,
    date: sp.get("date") || undefined,
    query: sp.get("q") || undefined,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
  });
  return apiJson(data);
}

export function OPTIONS() {
  return apiPreflight();
}
