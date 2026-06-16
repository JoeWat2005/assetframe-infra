"use server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "./db";

// Web Push subscription server-actions (Task T16). The client passes the JSON form of a
// browser PushSubscription (the same shape as JSON.stringify'ing the object the
// PushManager hands back). Login is required so we can target alerts at the user's
// watchlist; logged-out subscribing is disallowed.

// Browser PushSubscription serialized to JSON.
type BrowserSubscription = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

// Upsert a push subscription by endpoint, attaching the signed-in user and topics.
export async function saveSubscription(
  sub: BrowserSubscription,
  topics: string[] = []
): Promise<{ ok: boolean; message?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Sign in to enable notifications." };
  if (!sql) return { ok: false, message: "Notifications are unavailable right now." };

  const endpoint = (sub?.endpoint || "").trim();
  const p256dh = (sub?.keys?.p256dh || "").trim();
  const authKey = (sub?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !authKey) return { ok: false, message: "Invalid subscription." };

  const cleanTopics = Array.isArray(topics)
    ? topics.map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 50)
    : [];

  try {
    await sql.query(
      `INSERT INTO push_subscriptions (clerk_user_id, endpoint, p256dh, auth, topics, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (endpoint) DO UPDATE SET
         clerk_user_id = EXCLUDED.clerk_user_id,
         p256dh        = EXCLUDED.p256dh,
         auth          = EXCLUDED.auth,
         topics        = EXCLUDED.topics,
         last_seen_at  = now()`,
      [userId, endpoint, p256dh, authKey, cleanTopics]
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not enable notifications — please try again." };
  }
}

// Remove a push subscription by endpoint (called when the user disables notifications).
export async function removeSubscription(
  endpoint: string
): Promise<{ ok: boolean; message?: string }> {
  if (!sql) return { ok: false, message: "Notifications are unavailable right now." };
  const ep = (endpoint || "").trim();
  if (!ep) return { ok: false, message: "Invalid subscription." };
  try {
    await sql.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [ep]);
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not disable notifications — please try again." };
  }
}
