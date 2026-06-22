import { isAuthorizedCron } from "@/lib/cron";
import { sql } from "@/lib/db";
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

// Build the one-line push body. Confidence band is nullable (T12 column), so fall back to
// just status + risk when it's missing — never fabricate a band.
function editionBody(e: Edition): string {
  const parts = [e.status];
  if (e.confidenceBand) parts.push(`${e.confidenceBand} confidence`);
  if (e.risk) parts.push(`${e.risk} risk`);
  return `${e.instrument} — ${parts.filter(Boolean).join(", ")}`;
}

function instrumentPayload(e: Edition): PushPayload {
  return { title: `New edition: ${e.instrument}`, body: editionBody(e), data: { url: `${BASE}/reports/${e.id}` } };
}

// Push = per-instrument only (watchlist followers on this device).
// Email = newsletter digest to all confirmed 'digest' subscribers, unconditionally.
// These are independent channels — a user can legitimately receive both.
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
    const expiredEndpoints: string[] = [];

    // 1) WEB PUSH — per-instrument only. Only when configured; otherwise this block is skipped.
    //    Sends to subscriptions whose user follows a published symbol via their watchlist.
    if (pushConfigured) {
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
        const endpoint = String(row.endpoint);
        // Idempotency: claim (edition, endpoint) before sending so a re-run never double-sends
        // to the same device. A different day's edition has a new id, so it still notifies.
        const claim = (await sql.query(
          `INSERT INTO notification_log (ref, recipient, channel) VALUES ($1, $2, 'push')
           ON CONFLICT DO NOTHING RETURNING ref`,
          [ed.id, endpoint]
        )) as Record<string, unknown>[];
        if (claim.length === 0) continue; // already notified this device for this edition
        const r = await sendPush(
          { endpoint, p256dh: String(row.p256dh), auth: String(row.auth) },
          instrumentPayload(ed)
        );
        if (r.ok) {
          pushes++;
        } else if (r.expired) {
          expiredEndpoints.push(endpoint); // dead endpoint; pruned below, claim is moot
        } else {
          // transient failure — release the claim so a later run can retry.
          await sql.query(
            `DELETE FROM notification_log WHERE ref = $1 AND recipient = $2 AND channel = 'push'`,
            [ed.id, endpoint]
          ).catch(() => {});
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

    // 2) EMAIL — newsletter digest to all confirmed subscribers opted into 'digest'.
    //    Independent of push: every subscriber gets this regardless of push status.
    const subs = (await sql.query(
      `SELECT email, unsub_token FROM subscribers WHERE status = 'confirmed' AND 'digest' = ANY(topics)`
    )) as Record<string, unknown>[];
    let digests = 0;
    for (const s of subs) {
      const email = String(s.email);
      // Idempotency: one digest per subscriber per publish-day. Claim before sending; release
      // the claim on failure so a later run can retry.
      const claim = (await sql.query(
        `INSERT INTO notification_log (ref, recipient, channel)
         VALUES (to_char(CURRENT_DATE, 'YYYY-MM-DD'), $1, 'email_digest')
         ON CONFLICT DO NOTHING RETURNING ref`,
        [email]
      )) as Record<string, unknown>[];
      if (claim.length === 0) continue; // already sent today's digest to this subscriber
      const r = await sendEmail({
        to: email,
        subject: `New AssetFrame editions — ${list.length} today`,
        html: emailShell({
          heading: "New editions are live",
          bodyHtml:
            `<p style="font-size:14px;">Today&rsquo;s published editions:</p>` +
            `<ul style="padding-left:18px;font-size:14px;">${itemsHtml}</ul>` +
            `<p style="margin-top:12px;font-size:13px;color:#5b6b80;">Each report can span multiple timeframes — see how the calls perform per horizon in the <a href="${BASE}/track-record" style="color:#0b2545;font-weight:600;">per-timeframe track record</a>.</p>` +
            `<p style="margin-top:12px;font-size:14px;"><a href="${BASE}/reports" style="color:#0b2545;font-weight:600;">Browse all reports →</a></p>`,
          footerNote: `You subscribed to AssetFrame alerts. <a href="${BASE}/api/unsubscribe?token=${String(s.unsub_token)}">Unsubscribe</a>.`,
        }),
      });
      if (r.ok) {
        digests++;
      } else {
        await sql.query(
          `DELETE FROM notification_log WHERE ref = to_char(CURRENT_DATE, 'YYYY-MM-DD') AND recipient = $1 AND channel = 'email_digest'`,
          [email]
        ).catch(() => {});
      }
    }

    // alerts is always 0 now — per-instrument email alerts removed; push covers followers.
    return Response.json({ ok: true, editions: list.length, pushes, digests, alerts: 0 });
  } catch {
    return Response.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
