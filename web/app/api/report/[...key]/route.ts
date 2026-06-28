import { NextRequest, NextResponse } from "next/server";
import { getEntitlement } from "@/lib/entitlements";
import { signedReportUrl } from "@/lib/r2";
import { classifyReportKey } from "@/lib/report-key";
import { getEdition } from "@/lib/content";
import { rateLimitResponse, getRequestIp } from "@/lib/rate-limit";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// All report files live in private Cloudflare R2 and are served only through this gated
// handler. Tiers: preview.png is PUBLIC (a marketing thumbnail, cacheable); free.* needs
// an account; pro.* needs a subscription. The handler validates the key against a strict
// allow-list, checks entitlement server-side, then 302-redirects to a short-lived signed
// R2 URL (bytes render on the R2 origin). Credentials never leave the server.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key } = await ctx.params;
  const objectKey = (key ?? []).join("/");
  const tier = classifyReportKey(objectKey);
  if (!tier) return new NextResponse("Bad request", { status: 400 });

  if (tier !== "public") {
    const ent = await getEntitlement();
    if (!ent.signedIn) {
      const url = new URL("/sign-in", req.url);
      url.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    if (tier === "pro" && !ent.subscribed) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }

    // Throttle the (authenticated) enumeration path: keys are predictable, so cap how fast
    // one caller can mint signed URLs / probe <date>/<slug> combinations.
    const limited = await rateLimitResponse(req, `report:${ent.email ?? getRequestIp(req)}`, {
      limit: 60,
      windowSec: 60,
    });
    if (limited) return limited;

    // Only serve files for an actually-published edition. The engine uploads report bytes to
    // R2 *before* inserting the edition row as hidden=true (pending admin approval), and keys
    // are predictable — so without this a signed-in/Pro caller could pull unapproved,
    // pre-release reports. getEdition only returns non-hidden editions.
    const [date, slug] = objectKey.split("/");
    const edition = await getEdition(date, slug);
    if (!edition || (tier === "pro" && !edition.hasPro)) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Best-effort Pro-download logging, deduped per (user, report, kind) per hour so a
    // logged-in caller can't inflate the table / KPIs by hammering the route.
    if (tier === "pro" && sql) {
      const reportId = objectKey.split("/").slice(0, 2).join("/");
      const kind = objectKey.endsWith(".pdf") ? "pdf" : "html";
      try {
        await sql.query(
          `INSERT INTO download_log (report_id, kind, user_id)
           SELECT $1,$2,$3
           WHERE NOT EXISTS (
             SELECT 1 FROM download_log
             WHERE report_id = $1 AND kind = $2 AND user_id IS NOT DISTINCT FROM $3
               AND ts > now() - interval '1 hour'
           )`,
          [reportId, kind, ent.email ?? null]
        );
      } catch {
        /* logging is optional — a failure must not break the download */
      }
    }
  } else {
    // Public preview.png keys are predictable too, and the engine uploads bytes to R2 *before*
    // inserting the (hidden=true) edition row — so without this check a predictable preview key
    // could leak an unapproved/hidden edition's thumbnail. getEdition returns only non-hidden
    // editions, so 404 if it's missing or still hidden.
    const [date, slug] = objectKey.split("/");
    const edition = await getEdition(date, slug);
    if (!edition) return new NextResponse("Not found", { status: 404 });
  }

  // Public previews get a longer-lived signed URL + a cacheable redirect (they're just
  // thumbnails); gated files get a short URL and an uncacheable redirect.
  const signed = await signedReportUrl(objectKey, tier === "public" ? 600 : 120);
  if (!signed) {
    return new NextResponse("Report storage is not configured yet.", { status: 503 });
  }

  const res = NextResponse.redirect(signed, 302);
  res.headers.set(
    "Cache-Control",
    tier === "public" ? "public, max-age=300, s-maxage=300" : "private, no-store, max-age=0"
  );
  return res;
}
