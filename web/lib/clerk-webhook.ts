import crypto from "node:crypto";

// Verify a Clerk webhook (Svix-signed). Clerk signs over `${id}.${timestamp}.${body}`
// with the base64 secret (after the `whsec_` prefix), base64 HMAC-SHA256, and sends it in
// the `svix-signature` header as space-separated `v1,<sig>` entries. Timing-safe compare;
// rejects stale timestamps (>5 min) to limit replay.
export function verifyClerkWebhook(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const b = Buffer.from(expected);

  for (const part of signature.split(" ")) {
    const sig = part.split(",")[1];
    if (!sig) continue;
    const a = Buffer.from(sig);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
