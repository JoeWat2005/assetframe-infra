import "server-only";
import webpush, { WebPushError, type PushSubscription } from "web-push";

// Web Push (VAPID) sender. Mirrors lib/email.ts: disabled gracefully when the VAPID env
// vars are absent (sendPush returns {ok:false, skipped:true}) so the app builds/runs and
// the new-edition cron behaves IDENTICALLY to before (email-to-everyone) until keys are set.
//
// Required env (generate with `npx web-push generate-vapid-keys`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  — the keypair (the public key must also be
//                                          exposed to the client as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_SUBJECT                        — a 'mailto:' address (or https: URL) for the push service
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "";

export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY && SUBJECT);

// Set the VAPID details lazily/once on first send, so importing this module never throws
// when the keys are unset (web-push.setVapidDetails validates the subject + keys eagerly).
let vapidReady = false;
function ensureVapid() {
  if (vapidReady || !pushConfigured) return;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  vapidReady = true;
}

// Stored-subscription shape (matches the push_subscriptions table columns we persist).
export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Payload the service worker's `push` listener expects (see public/sw.js).
export type PushPayload = {
  title: string;
  body: string;
  data?: { url?: string };
};

export type PushResult =
  | { ok: true }
  | { ok: false; skipped?: true; expired?: true; error?: string };

// Send one notification. Returns {expired:true} when the endpoint is gone (404/410) so the
// caller can prune the row; {skipped:true} when push is unconfigured; {error} otherwise.
export async function sendPush(
  sub: StoredPushSubscription,
  payload: PushPayload
): Promise<PushResult> {
  if (!pushConfigured) return { ok: false, skipped: true };
  ensureVapid();
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
      return { ok: false, expired: true };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
