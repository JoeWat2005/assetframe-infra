import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyClerkWebhook } from "../lib/clerk-webhook";

// Security: the Clerk webhook GRANTS or REVOKES paid access (Clerk Billing subscription events)
// and deletes user data (user.deleted). It must reject any payload that is unsigned, mis-signed,
// replayed, or tampered. These tests focus on the rejection paths an attacker would probe (no
// signature, wrong secret, modified body, stale timestamp).

// ---- Clerk webhook (Svix-signed) ----
const CLERK_SECRET = "whsec_" + Buffer.from("clerk_signing_secret_bytes").toString("base64");
function clerkSign(id: string, ts: string, body: string, secret = CLERK_SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
}
const nowSec = () => String(Math.floor(Date.now() / 1000));

describe("Clerk webhook signature — rejection paths", () => {
  const id = "msg_1";
  const body = JSON.stringify({ type: "user.deleted", data: { id: "user_x" } });

  it("accepts a correctly signed, fresh webhook", () => {
    const ts = nowSec();
    expect(verifyClerkWebhook(body, { id, timestamp: ts, signature: clerkSign(id, ts, body) }, CLERK_SECRET)).toBe(true);
  });

  it("REJECTS missing svix headers", () => {
    const ts = nowSec();
    expect(verifyClerkWebhook(body, { id: null, timestamp: ts, signature: clerkSign(id, ts, body) }, CLERK_SECRET)).toBe(false);
    expect(verifyClerkWebhook(body, { id, timestamp: null, signature: clerkSign(id, ts, body) }, CLERK_SECRET)).toBe(false);
    expect(verifyClerkWebhook(body, { id, timestamp: ts, signature: null }, CLERK_SECRET)).toBe(false);
  });

  it("REJECTS when the server secret is unset", () => {
    const ts = nowSec();
    expect(verifyClerkWebhook(body, { id, timestamp: ts, signature: clerkSign(id, ts, body) }, "")).toBe(false);
  });

  it("REJECTS a tampered body", () => {
    const ts = nowSec();
    expect(verifyClerkWebhook(body + " ", { id, timestamp: ts, signature: clerkSign(id, ts, body) }, CLERK_SECRET)).toBe(false);
  });

  it("REJECTS a signature from the wrong secret", () => {
    const ts = nowSec();
    const other = "whsec_" + Buffer.from("different").toString("base64");
    expect(verifyClerkWebhook(body, { id, timestamp: ts, signature: clerkSign(id, ts, body, other) }, CLERK_SECRET)).toBe(false);
  });

  it("REJECTS a stale timestamp (replay window > 5 min)", () => {
    const stale = String(Math.floor(Date.now() / 1000) - 4000);
    expect(verifyClerkWebhook(body, { id, timestamp: stale, signature: clerkSign(id, stale, body) }, CLERK_SECRET)).toBe(false);
  });

  it("REJECTS a future timestamp outside the window", () => {
    const future = String(Math.floor(Date.now() / 1000) + 4000);
    expect(verifyClerkWebhook(body, { id, timestamp: future, signature: clerkSign(id, future, body) }, CLERK_SECRET)).toBe(false);
  });

  it("REJECTS a non-numeric timestamp without throwing", () => {
    expect(() => verifyClerkWebhook(body, { id, timestamp: "not-a-number", signature: clerkSign(id, "x", body) }, CLERK_SECRET)).not.toThrow();
    expect(verifyClerkWebhook(body, { id, timestamp: "not-a-number", signature: clerkSign(id, "x", body) }, CLERK_SECRET)).toBe(false);
  });
});
