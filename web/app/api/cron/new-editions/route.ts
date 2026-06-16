import { isAuthorizedCron } from "@/lib/cron";
import { sql } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail, emailShell } from "@/lib/email";
import { pushConfigured, sendPush, type PushPayload } from "@/lib/push";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = SITE.url.replace(/\/$/, "");
const li = (e: { id: string; instrument: string; status: string }) =>
  `<li style="margin-bottom:6px;"><a href="${BASE}/reports/${e.id}" style="color:#0b2545;font-weight:600;">${e.instrument}</a> — ${e.status}</li>`;

// Edition shape used by both the push payload and the email list.
type Edition = {
  id: string;
  slug: string;
  instrument: string;
  status: string;
  risk: string;
  confidenceBand: string;
};

// Stored push subscription row (push_subscriptions table).
type PushRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  clerk_user_id: string | null;
  topics: string[];
};

// Build the one-line push body. Confidence band is nullable (T12 column), so fall back to
// just status + risk when it's missing — never fabricate a band.
function editionBody(e: Edition): string {
  const parts = [e.status];
  if (e.confidenceBand) parts.push(`${e.confidenceBand} confidence`);
  if (e.risk) parts.push(`${e.risk} risk`);
  return `${e.instrument} — ${parts.filter(Boolean).join(", ")}`;
}

function digestPayload(list: Edition[]): PushPayload {
  return {
    title: `New AssetFrame editions — ${list.length} today`,
    body:
      list.length === 1
        ? editionBody(list[0])
        : `${list.length} new editions are live: ${list.map((e) => e.instrument).join(", ")}`,
    data: { url: `${BASE}/reports` },
  };
}

function instrumentPayload(e: Edition): PushPayload {
  return { title: `New edition: ${e.instrument}`, body: editionBody(e), data: { url: `${BASE}/reports/${e.id}` } };
}

// Daily digest of the day's new editions. Web push is the PRIMARY channel; email is the
// fallback for users with no active push subscription. When push is UNCONFIGURED the
// behaviour is identical to before (digest to every confirmed subscriber + alert to every
// follower).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });
  if (!sql) return Response.json({ ok: false, reason: "no-db" });
  try {
    const eds = (await sql.query(
      `SELECT e.id, e.slug, e.instrument, e.status, e.risk, e.confidence_band
         FROM editions e
        WHERE coalesce(e.hidden, false) = false AND e.report_date = CURRENT_DATE
        ORDER BY e.instrument`
    )) as Record<string, unknown>[];
    if (eds.length === 0) return Response.json({ ok: true, editions: 0, pushes: 0, digests: 0, alerts: 0 });

    const list: Edition[] = eds.map((e) => ({
      id: String(e.id),
      slug: String(e.slug),
      instrument: String(e.instrument),
      status: String(e.status ?? ""),
      risk: e.risk == null ? "" : String(e.risk),
      confidenceBand: e.confidence_band == null ? "" : String(e.confidence_band),
    }));
    const itemsHtml = list.map(li).join("");
    const slugs = list.map((e) => e.slug);

    let pushes = 0;
    // Users we've already reached by push, so email can skip them (email-fallback rule).
    const pushedUserIds = new Set<string>();
    const expiredEndpoints: string[] = [];

    // 1) WEB PUSH (primary). Only when configured; otherwise this block is skipped and the
    //    email section below runs for everyone exactly as it did before.
    if (pushConfigured) {
      // 1a) Digest push to every subscription opted into the 'digest' topic (empty topics
      //     array counts as digest-by-default).
      const digestSubs = (await sql.query(
        `SELECT endpoint, p256dh, auth, clerk_user_id, topics
           FROM push_subscriptions
          WHERE 'digest' = ANY(topics) OR cardinality(topics) = 0`
      )) as unknown as PushRow[];
      const digest = digestPayload(list);
      for (const s of digestSubs) {
        const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, digest);
        if (r.ok) {
          pushes++;
          if (s.clerk_user_id) pushedUserIds.add(s.clerk_user_id);
        } else if (r.expired) {
          expiredEndpoints.push(s.endpoint);
        }
      }

      // 1b) Per-instrument pushes to subscriptions whose user follows a published symbol.
      const followerSubs = (await sql.query(
        `SELECT ps.endpoint, ps.p256dh, ps.auth, ps.clerk_user_id, w.symbol
           FROM push_subscriptions ps
           JOIN watchlists w ON w.clerk_user_id = ps.clerk_user_id
          WHERE w.symbol = ANY($1)`,
        [slugs]
      )) as Record<string, unknown>[];
      const bySlug = new Map(list.map((e) => [e.slug, e]));
      for (const row of followerSubs) {
        const ed = bySlug.get(String(row.symbol));
        if (!ed) continue;
        const r = await sendPush(
          { endpoint: String(row.endpoint), p256dh: String(row.p256dh), auth: String(row.auth) },
          instrumentPayload(ed)
        );
        if (r.ok) {
          pushes++;
          if (row.clerk_user_id) pushedUserIds.add(String(row.clerk_user_id));
        } else if (r.expired) {
          expiredEndpoints.push(String(row.endpoint));
        }
      }

      // Prune endpoints the push service reported as gone (404/410).
      if (expiredEndpoints.length) {
        try {
          await sql.query(`DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`, [expiredEndpoints]);
        } catch {
          /* pruning is best-effort */
        }
      }
    }

    // 2) EMAIL FALLBACK — digest to confirmed subscribers whose user has NO active push sub.
    //    Approximation: skip email if that user has any push_subscriptions row at all (covers
    //    users we couldn't reach this run because their endpoint just expired, which is fine —
    //    they re-subscribe and get the next one). When push is unconfigured, pushedUserIds is
    //    empty so this sends to everyone, identical to the original behaviour.
    const subs = (await sql.query(
      `SELECT email, unsub_token, clerk_user_id FROM subscribers WHERE status = 'confirmed' AND 'digest' = ANY(topics)`
    )) as Record<string, unknown>[];
    let digests = 0;
    for (const s of subs) {
      const uid = s.clerk_user_id == null ? null : String(s.clerk_user_id);
      if (uid && pushedUserIds.has(uid)) continue; // reached by push already
      const r = await sendEmail({
        to: String(s.email),
        subject: `New AssetFrame editions — ${list.length} today`,
        html: emailShell({
          heading: "New editions are live",
          bodyHtml:
            `<p style="font-size:14px;">Today&rsquo;s published editions:</p>` +
            `<ul style="padding-left:18px;font-size:14px;">${itemsHtml}</ul>` +
            `<p style="margin-top:12px;font-size:14px;"><a href="${BASE}/reports" style="color:#0b2545;font-weight:600;">Browse all reports →</a></p>`,
          footerNote: `You subscribed to AssetFrame alerts. <a href="${BASE}/api/unsubscribe?token=${String(s.unsub_token)}">Unsubscribe</a>.`,
        }),
      });
      if (r.ok) digests++;
    }

    // 3) EMAIL FALLBACK — per-instrument alerts to followers with no active push sub.
    let alerts = 0;
    const followers = (await sql.query(
      `SELECT clerk_user_id, array_agg(symbol) AS symbols FROM watchlists WHERE symbol = ANY($1) GROUP BY clerk_user_id`,
      [slugs]
    )) as Record<string, unknown>[];
    if (followers.length) {
      // Which followers already have any push subscription? Skip their email.
      const followerIds = followers.map((f) => String(f.clerk_user_id));
      const pushedFollowerIds = new Set<string>();
      if (pushConfigured) {
        const rows = (await sql.query(
          `SELECT DISTINCT clerk_user_id FROM push_subscriptions WHERE clerk_user_id = ANY($1)`,
          [followerIds]
        )) as Record<string, unknown>[];
        for (const r of rows) if (r.clerk_user_id) pushedFollowerIds.add(String(r.clerk_user_id));
      }

      let cc: Awaited<ReturnType<typeof clerkClient>> | null = null;
      try { cc = await clerkClient(); } catch { cc = null; }
      if (cc) {
        for (const f of followers) {
          const uid = String(f.clerk_user_id);
          if (pushedFollowerIds.has(uid)) continue; // reached by push already
          const syms = Array.isArray(f.symbols) ? (f.symbols as string[]) : [];
          const matched = list.filter((e) => syms.includes(e.slug));
          if (!matched.length) continue;
          try {
            const u = await cc.users.getUser(uid);
            const email = u.primaryEmailAddress?.emailAddress;
            if (!email) continue;
            const r = await sendEmail({
              to: email,
              subject: `New edition${matched.length > 1 ? "s" : ""} for instruments you follow`,
              html: emailShell({
                heading: "An instrument you follow has a new edition",
                bodyHtml:
                  `<ul style="padding-left:18px;font-size:14px;">${matched.map(li).join("")}</ul>` +
                  `<p style="margin-top:12px;font-size:14px;"><a href="${BASE}/account" style="color:#0b2545;font-weight:600;">Manage what you follow →</a></p>`,
              }),
            });
            if (r.ok) alerts++;
          } catch {
            /* skip this follower */
          }
        }
      }
    }

    return Response.json({ ok: true, editions: list.length, pushes, digests, alerts });
  } catch {
    return Response.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
