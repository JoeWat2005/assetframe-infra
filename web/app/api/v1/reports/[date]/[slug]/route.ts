import { getReportDetail } from "@/lib/reports-api";
import { apiJson, apiPreflight } from "@/lib/http";
import { isValidReportRef } from "@/lib/report-key";

export const dynamic = "force-dynamic";

// GET /api/v1/reports/{date}/{slug} — free Snapshot detail (metadata + text + short-lived PDF link).
export async function GET(_req: Request, ctx: { params: Promise<{ date: string; slug: string }> }) {
  const { date, slug } = await ctx.params;
  // Reject malformed date/slug before touching the data layer (the lookup is parameterized,
  // but this keeps garbage/path-traversal slugs out entirely). Same 404 shape as a real miss.
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
