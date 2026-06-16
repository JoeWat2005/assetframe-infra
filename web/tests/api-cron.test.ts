import { describe, it, expect, beforeEach, vi } from "vitest";

// lib/cron imports "server-only", which throws when imported outside an RSC build (e.g. in a
// plain vitest/node run). Neutralize the marker so we can unit-test the auth gate directly.
// (Hoisted above the import below by vitest.)
vi.mock("server-only", () => ({}));

import { isAuthorizedCron } from "../lib/cron";

const reqWith = (auth?: string) =>
  new Request("https://example.test/api/cron/new-editions", auth ? { headers: { authorization: auth } } : undefined);

describe("isAuthorizedCron — fail-closed CRON_SECRET gate", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("REJECTS when no secret is configured, even with a bearer header (fail-closed)", () => {
    // Critical: a missing CRON_SECRET must never make the cron endpoint world-callable.
    expect(isAuthorizedCron(reqWith("Bearer anything"))).toBe(false);
    expect(isAuthorizedCron(reqWith(undefined))).toBe(false);
  });

  it("REJECTS a wrong token", () => {
    process.env.CRON_SECRET = "right-secret";
    expect(isAuthorizedCron(reqWith("Bearer wrong-secret"))).toBe(false);
  });

  it("REJECTS a missing Authorization header when a secret IS set", () => {
    process.env.CRON_SECRET = "right-secret";
    expect(isAuthorizedCron(reqWith(undefined))).toBe(false);
  });

  it("REJECTS a correct secret without the 'Bearer ' scheme prefix", () => {
    process.env.CRON_SECRET = "right-secret";
    expect(isAuthorizedCron(reqWith("right-secret"))).toBe(false);
  });

  it("REJECTS a token that is a prefix/suffix of the secret (length-checked compare)", () => {
    process.env.CRON_SECRET = "right-secret";
    expect(isAuthorizedCron(reqWith("Bearer right-secre"))).toBe(false); // shorter
    expect(isAuthorizedCron(reqWith("Bearer right-secret-extra"))).toBe(false); // longer
  });

  it("ACCEPTS the exact 'Bearer <secret>' Vercel Cron sends", () => {
    process.env.CRON_SECRET = "right-secret";
    expect(isAuthorizedCron(reqWith("Bearer right-secret"))).toBe(true);
  });
});
