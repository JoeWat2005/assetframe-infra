import { NextRequest, NextResponse } from "next/server";
import { getEntitlement } from "@/lib/entitlements";
import { signedReportUrl } from "@/lib/r2";
import { classifyReportKey } from "@/lib/report-key";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// All report files (free Snapshots AND Pro reports) live in private Cloudflare R2 and
// are served only through this gated handler — there is no public/static path to a
// report. Free files require an account; Pro files require a subscription. The handler
// validates the key against a strict allow-list, checks entitlement server-side, then
// 302-redirects to a short-lived signed R2 URL (the bytes render on the R2 origin, away
// from this app's session cookies). Credentials never leave the server.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key } = await ctx.params;
  const objectKey = (key ?? []).join("/");
  const tier = classifyReportKey(objectKey);
  if (!tier) return new NextResponse("Bad request", { status: 400 });

  const ent = await getEntitlement();
  if (!ent.signedIn) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (tier === "pro" && !ent.subscribed) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  const signed = await signedReportUrl(objectKey);
  if (!signed) {
    return new NextResponse("Report storage is not configured yet.", { status: 503 });
  }

  // Best-effort Pro-download logging for the admin dashboard (never blocks the download).
  if (tier === "pro" && sql) {
    const reportId = objectKey.split("/").slice(0, 2).join("/");
    const kind = objectKey.endsWith(".pdf") ? "pdf" : "html";
    try {
      await sql.query(
        `INSERT INTO download_log (report_id, kind, user_id) VALUES ($1,$2,$3)`,
        [reportId, kind, ent.email ?? null]
      );
    } catch {
      /* logging is optional — a failure must not break the download */
    }
  }

  // The 302 embeds a time-limited credential, so it must never be cached by a shared cache.
  const res = NextResponse.redirect(signed, 302);
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}
