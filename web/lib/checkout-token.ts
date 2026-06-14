import crypto from "node:crypto";

// Compact, HMAC-signed token that binds a checkout to a specific Clerk user id, so the
// webhook can grant Pro to exactly that account regardless of the email typed at checkout.
// Signed with a server-only secret, so it cannot be forged for someone else's account.
// MUST stay server-side (reads a secret). Format: base64url(payload).base64url(hmac).
const secret = () => process.env.CHECKOUT_TOKEN_SECRET || process.env.CLERK_SECRET_KEY || "";
const TTL_SECONDS = 60 * 60; // tokens are good for an hour — plenty to complete a checkout

const b64url = (b: Buffer) => b.toString("base64url");
const nowSec = () => Math.floor(Date.now() / 1000);

export function signCheckoutToken(userId: string): string {
  const s = secret();
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, e: nowSec() + TTL_SECONDS })));
  const sig = b64url(crypto.createHmac("sha256", s).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the authenticated user id if the token is valid + unexpired, else null.
export function verifyCheckoutToken(token: string | undefined | null): string | null {
  const s = secret();
  if (!token || !s) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac("sha256", s).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u?: unknown; e?: unknown };
    if (typeof obj.u !== "string" || typeof obj.e !== "number") return null;
    if (obj.e < nowSec()) return null; // expired
    return obj.u;
  } catch {
    return null;
  }
}
