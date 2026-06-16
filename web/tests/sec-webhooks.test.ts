import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyLemonSignature, subscriptionStateFromEvent } from "../lib/lemonsqueezy";
import { verifyClerkWebhook } from "../lib/clerk-webhook";

// Security: both webhooks GRANT or REVOKE paid access. They must reject any payload that is
// unsigned, mis-signed, replayed, or tampered. These tests focus on the rejection paths an
// attacker would probe (no signature, wrong secret, modified body, stale timestamp) plus the
// billing-state mapping that decides who keeps Pro.

const LS_SECRET = "ls_test_signing_secret";
const lsSign = (body: string, secret = LS_SECRET) =>
  crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("Lemon Squeezy webhook signature — rejection paths", () => {
  const body = JSON.stringify({ meta: { event_name: "subscription_created" }, data: { id: 1 } });

  it("accepts the genuine HMAC over the RAW body", () => {
    expect(verifyLemonSignature(body, lsSign(body), LS_SECRET)).toBe(true);
  });

  it("REJECTS a missing signature (unsigned forgery)", () => {
    expect(verifyLemonSignature(body, null, LS_SECRET)).toBe(false);
    expect(verifyLemonSignature(body, "", LS_SECRET)).toBe(false);
  });

  it("REJECTS when the server secret is unset (no secret ⇒ never trust)", () => {
    expect(verifyLemonSignature(body, lsSign(body), "")).toBe(false);
  });

  it("REJECTS a signature made with the wrong secret", () => {
    expect(verifyLemonSignature(body, lsSign(body, "attacker-secret"), LS_SECRET)).toBe(false);
  });

  it("REJECTS a tampered body (sig no longer matches)", () => {
    const tampered = body.replace("subscription_created", "subscription_expired");
    expect(verifyLemonSignature(tampered, lsSign(body), LS_SECRET)).toBe(false);
  });

  it("REJECTS a malformed, wrong-length signature WITHOUT throwing", () => {
    expect(verifyLemonSignature(body, "deadbeef", LS_SECRET)).toBe(false);
    expect(() => verifyLemonSignature(body, "deadbeef", LS_SECRET)).not.toThrow();
  });
});

describe("Lemon Squeezy billing-state mapping (who keeps Pro)", () => {
  it("grants on active / trial / successful payment", () => {
    expect(subscriptionStateFromEvent("subscription_created", "active")).toBe(true);
    expect(subscriptionStateFromEvent("subscription_created", "on_trial")).toBe(true);
    expect(subscriptionStateFromEvent("subscription_payment_success", "active")).toBe(true);
  });
  it("keeps access while cancelling (paid through period end) and during dunning (past_due)", () => {
    expect(subscriptionStateFromEvent("subscription_cancelled", "cancelled")).toBe(true);
    expect(subscriptionStateFromEvent("subscription_payment_failed", "past_due")).toBe(true);
  });
  it("revokes on expiry / unpaid / paused", () => {
    expect(subscriptionStateFromEvent("subscription_expired", "expired")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_updated", "unpaid")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_paused", "paused")).toBe(false);
  });
  it("ALWAYS revokes on refund/chargeback regardless of reported status", () => {
    expect(subscriptionStateFromEvent("subscription_payment_refunded", "active")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_payment_refunded", undefined)).toBe(false);
  });
  it("returns null (leave access unchanged) for unrelated events / unknown statuses", () => {
    expect(subscriptionStateFromEvent("order_created", "paid")).toBeNull();
    expect(subscriptionStateFromEvent("subscription_updated", "mystery")).toBeNull();
  });
});

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
