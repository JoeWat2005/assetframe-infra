import { describe, it, expect, beforeAll } from "vitest";
import { signCheckoutToken, verifyCheckoutToken } from "../lib/checkout-token";

describe("checkout token", () => {
  beforeAll(() => { process.env.CHECKOUT_TOKEN_SECRET = "test_secret_value_xyz"; });

  it("round-trips the signed-in user id", () => {
    const t = signCheckoutToken("user_abc123");
    expect(verifyCheckoutToken(t)).toBe("user_abc123");
  });

  it("rejects a tampered signature", () => {
    const t = signCheckoutToken("user_abc123");
    expect(verifyCheckoutToken(t + "x")).toBeNull();
  });

  it("cannot swap the user id under the original signature (no forgery)", () => {
    const t = signCheckoutToken("user_abc123");
    const sig = t.slice(t.lastIndexOf(".") + 1);
    const forgedPayload = Buffer.from(JSON.stringify({ u: "user_victim", e: 9_999_999_999 })).toString("base64url");
    expect(verifyCheckoutToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const t = signCheckoutToken("user_abc123");
    process.env.CHECKOUT_TOKEN_SECRET = "a_different_secret";
    expect(verifyCheckoutToken(t)).toBeNull();
    process.env.CHECKOUT_TOKEN_SECRET = "test_secret_value_xyz";
  });

  it("rejects empty / malformed input", () => {
    expect(verifyCheckoutToken("")).toBeNull();
    expect(verifyCheckoutToken("garbage")).toBeNull();
    expect(verifyCheckoutToken(undefined)).toBeNull();
  });
});
