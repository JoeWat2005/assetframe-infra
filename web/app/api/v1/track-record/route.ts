import { getTrackRecordPayload } from "@/lib/reports-api";
import { apiJson, apiPreflight } from "@/lib/http";
import { rateLimitResponseWithHeaders, getRequestIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/v1/track-record — PUBLIC (no key required), per-IP rate limit: 120 req/min.
// Optional ?timeframe=daily|weekly|hourly filters to one horizon; ?cadence=daily|weekly|monthly
// filters to one scoring cadence. The payload always carries the per-timeframe breakdown
// (byHorizon) and the per-cadence breakdown (byCadence).
export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitResponseWithHeaders(req, `ip:${ip}`, { limit: 120, windowSec: 60 });
  if (rl) return rl;

  const params = new URL(req.url).searchParams;
  const timeframe = params.get("timeframe") || undefined;
  const cadence = params.get("cadence") || undefined;
  return apiJson(await getTrackRecordPayload({ horizon: timeframe, cadence }));
}

export function OPTIONS() {
  return apiPreflight();
}
