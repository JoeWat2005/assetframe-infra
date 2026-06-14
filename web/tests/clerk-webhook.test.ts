import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyClerkWebhook } from "../lib/clerk-webhook";

const SECRET = "whsec_" + Buffer.from("clerk_signing_key_bytes_here").toString("base64");

function sign(id: string, ts: string, body: string, secret = SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
}

describe("verifyClerkWebhook", () => {
  const id = "msg_1";
  const body = JSON.stringify({ type: "user.deleted", data: { id: "user_x" } });
  const now = () => String(Math.floor(Date.now() / 1000));

  it("accepts a correctly signed, fresh webhook", () => {
    const ts = now();
    expect(verifyClerkWebhook(body, { id, timestamp: ts, signature: sign(id, ts, body) }, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ts = now();
    expect(verifyClerkWebhook(body + " ", { id, timestamp: ts, signature: sign(id, ts, body) }, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const ts = now();
    const other = "whsec_" + Buffer.from("different_key").toString("base64");
    expect(verifyClerkWebhook(body, { id, timestamp: ts, signature: sign(id, ts, body, other) }, SECRET)).toBe(false);
  });

  it("rejects a stale timestamp (replay)", () => {
    const old = String(Math.floor(Date.now() / 1000) - 4000);
    expect(verifyClerkWebhook(body, { id, timestamp: old, signature: sign(id, old, body) }, SECRET)).toBe(false);
  });

  it("rejects missing headers", () => {
    const ts = now();
    expect(verifyClerkWebhook(body, { id: null, timestamp: ts, signature: sign(id, ts, body) }, SECRET)).toBe(false);
  });
});
