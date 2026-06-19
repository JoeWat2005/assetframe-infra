import { describe, it, expect } from "vitest";
import { computeEntitlement, SIGNED_OUT, type PublicMeta } from "../lib/access";

// Authorization matrix for the centralized entitlement derivation (lib/access.ts), which is
// what every gate ultimately consults: the report download route, the MCP Pro tool, the
// reader and the account/admin pages. This locks the launch-critical access states:
//   signed-out · free · pro (paying) · cancelled-but-not-expired · admin · admin-preview.
// UI gating is never trusted — these are the server-side booleans that actually grant access.
const ADMINS = ["admin@assetframe.co.uk"];
const ent = (meta: PublicMeta, email?: string) => computeEntitlement(meta, email, ADMINS);

describe("entitlement matrix — who can reach Pro", () => {
  it("SIGNED-OUT: not signed in, no Pro, no admin (the shared constant)", () => {
    expect(SIGNED_OUT).toMatchObject({ signedIn: false, subscribed: false, billingActive: false, admin: false });
  });

  it("FREE (signed-in, no subscription): cannot reach Pro", () => {
    const e = ent({}, "free@example.com");
    expect(e.signedIn).toBe(true);
    expect(e.subscribed).toBe(false); // gate: pro.* download / get_pro_report must be denied
    expect(e.billingActive).toBe(false);
    expect(e.admin).toBe(false);
  });

  it("PRO (paying subscriber): reaches Pro and is billingActive", () => {
    const e = ent({ subscribed: true, subscriptionId: "sub_1", subStatus: "active" }, "pro@example.com");
    expect(e.subscribed).toBe(true);
    expect(e.billingActive).toBe(true);
    expect(e.admin).toBe(false);
    expect(e.subscriptionId).toBe("sub_1");
  });

  it("CANCELLED-but-not-expired: webhook keeps subscribed=true until period end → still Pro", () => {
    // The Clerk Billing webhook leaves meta.subscribed=true while a 'past_due' grace window or a
    // cancelled-but-not-yet-ended term runs, and only flips it to false on the terminal
    // ended/expired event. So a cancelling user keeps access until the term ends.
    const e = ent({ subscribed: true, subStatus: "cancelled", endsAt: "2026-12-01T00:00:00Z" }, "cxl@example.com");
    expect(e.subscribed).toBe(true);
    expect(e.billingActive).toBe(true);
    expect(e.subStatus).toBe("cancelled");
  });

  it("EXPIRED: webhook has set subscribed=false → no Pro", () => {
    const e = ent({ subscribed: false, subStatus: "expired" }, "exp@example.com");
    expect(e.subscribed).toBe(false);
    expect(e.billingActive).toBe(false);
  });

  it("ADMIN by email allow-list: comped Pro, but NOT billingActive (never paid)", () => {
    const e = ent({}, "admin@assetframe.co.uk");
    expect(e.admin).toBe(true);
    expect(e.subscribed).toBe(true);
    expect(e.billingActive).toBe(false);
  });

  it("ADMIN by Clerk role: comped Pro regardless of email", () => {
    const e = ent({ role: "admin" }, "someone@nowhere.test");
    expect(e.admin).toBe(true);
    expect(e.subscribed).toBe(true);
    expect(e.billingActive).toBe(false);
  });

  it("ADMIN previewing the free tier: keeps admin, drops Pro (so they see the free product)", () => {
    const e = ent({ role: "admin", adminTier: "free" }, "admin@assetframe.co.uk");
    expect(e.admin).toBe(true);
    expect(e.subscribed).toBe(false);
  });

  it("ADMIN preview-free wins over a paid flag (admin Pro is decoupled from billing)", () => {
    const e = ent({ role: "admin", adminTier: "free", subscribed: true }, "admin@assetframe.co.uk");
    expect(e.admin).toBe(true);
    expect(e.subscribed).toBe(false);
    expect(e.billingActive).toBe(true);
  });
});

describe("privilege-escalation guards", () => {
  it("a free user CANNOT self-grant admin by setting adminTier in their own metadata", () => {
    // adminTier is only meaningful for an actual admin; a forged value is inert.
    const e = ent({ adminTier: "pro" }, "attacker@example.com");
    expect(e.admin).toBe(false);
    expect(e.subscribed).toBe(false);
  });

  it("a free user CANNOT become admin via a bogus role string", () => {
    const e = ent({ role: "superuser" as unknown as string }, "attacker@example.com");
    expect(e.admin).toBe(false);
    expect(e.subscribed).toBe(false);
  });

  it("email allow-list is case-insensitive on the caller email but exact on membership", () => {
    // entitlements.ts lowercases the email before calling; a different address is not admin.
    expect(ent({}, "ADMIN@assetframe.co.uk".toLowerCase()).admin).toBe(true);
    expect(ent({}, "admin@assetframe.co.uk.evil.com").admin).toBe(false);
    expect(ent({}, "notadmin@assetframe.co.uk").admin).toBe(false);
  });

  it("no email + no role = never admin (signed-in but anonymous-ish)", () => {
    expect(ent({}, undefined).admin).toBe(false);
  });
});
