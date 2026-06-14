import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyLemonSignature, subscriptionStateFromEvent } from "../lib/lemonsqueezy";

const SECRET = "whsec_test_signing_secret";
const sign = (body: string, secret = SECRET) =>
  crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("verifyLemonSignature", () => {
  const body = JSON.stringify({ meta: { event_name: "subscription_created" } });

  it("accepts a correct signature", () => {
    expect(verifyLemonSignature(body, sign(body), SECRET)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyLemonSignature(body + " ", sign(body), SECRET)).toBe(false);
  });
  it("rejects a signature made with the wrong secret", () => {
    expect(verifyLemonSignature(body, sign(body, "attacker"), SECRET)).toBe(false);
  });
  it("rejects a missing signature or missing secret", () => {
    expect(verifyLemonSignature(body, null, SECRET)).toBe(false);
    expect(verifyLemonSignature(body, sign(body), "")).toBe(false);
  });
  it("rejects a malformed (different-length) signature without throwing", () => {
    expect(verifyLemonSignature(body, "abc123", SECRET)).toBe(false);
  });
});

describe("subscriptionStateFromEvent", () => {
  it("grants access on a new subscription, trial or successful payment", () => {
    expect(subscriptionStateFromEvent("subscription_created", "active")).toBe(true);
    expect(subscriptionStateFromEvent("subscription_created", "on_trial")).toBe(true);
    expect(subscriptionStateFromEvent("subscription_payment_success", "active")).toBe(true);
  });

  it("KEEPS access when cancelled-but-not-yet-expired (paid through period end)", () => {
    expect(subscriptionStateFromEvent("subscription_cancelled", "cancelled")).toBe(true);
  });

  it("KEEPS access during a failed-payment dunning window (past_due)", () => {
    expect(subscriptionStateFromEvent("subscription_payment_failed", "past_due")).toBe(true);
  });

  it("revokes access on expiry, unpaid or pause", () => {
    expect(subscriptionStateFromEvent("subscription_expired", "expired")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_updated", "unpaid")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_paused", "paused")).toBe(false);
  });

  it("REVOKES on a refund / chargeback regardless of the reported status", () => {
    expect(subscriptionStateFromEvent("subscription_payment_refunded", "active")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_payment_refunded", "paid")).toBe(false);
    expect(subscriptionStateFromEvent("subscription_payment_refunded", undefined)).toBe(false);
  });

  it("ignores unrelated events and unknown statuses", () => {
    expect(subscriptionStateFromEvent("order_created", "paid")).toBeNull();
    expect(subscriptionStateFromEvent("subscription_updated", "mystery")).toBeNull();
    expect(subscriptionStateFromEvent("subscription_updated", undefined)).toBeNull();
  });
});
