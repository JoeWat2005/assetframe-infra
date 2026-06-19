import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { verifyClerkWebhook } from "@/lib/clerk-webhook";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Clerk webhook. Two responsibilities, both verified with the same svix signature
// (CLERK_WEBHOOK_SECRET). Configure in Clerk Dashboard -> Webhooks: endpoint
// /api/webhooks/clerk, and subscribe to:
//   - user.deleted              -> cascade-delete the user's data in our DB
//   - subscription.*            -> grant/revoke Pro (publicMetadata.subscribed)
//   - subscriptionItem.*        -> grant/revoke Pro at the item level (incl. cancellation)
// Clerk Billing is the source of truth for Pro; this webhook mirrors a paid 'pro'
// subscription onto publicMetadata.subscribed, which lib/access.ts derives access from.
// Clerk Billing tears the subscription down itself on user deletion, so user.deleted no
// longer touches billing.

// The Plan whose active subscription grants Pro. Matches the Clerk Billing plan slug.
const PRO_PLAN_SLUG = "pro";

// Statuses that GRANT access (the subscription/item is paid, or paid-through a grace/period
// end). 'cancelled' keeps access until the term actually ends, when an 'ended'/'expired'
// event flips it off — same lifecycle the old LS webhook honoured. Mirrors the status table
// in the clerk-billing billing-webhooks reference.
// A free trial reports as `active` (Clerk's status enum has no `trialing`), but we include
// trial variants defensively so a configured free trial reliably grants Pro either way.
const ACTIVE_STATUSES = new Set(["active", "trialing", "trial", "past_due"]);
// Terminal statuses that REVOKE access. 'canceled' here means the term has fully ended (the
// item-level cancellation grace is represented as a status, not necessarily this set); we also
// revoke on these regardless of plan so a lingering flag can't survive teardown.
const TERMINAL_STATUSES = new Set(["ended", "expired", "abandoned"]);

// ---- Billing payload shape (raw JSON; Clerk sends snake_case in webhook bodies) ----
type BillingPlan = { id?: string; slug?: string; name?: string };
type BillingPayer = { user_id?: string; organization_id?: string; email?: string };
type BillingItem = {
  status?: string;
  plan?: BillingPlan;
  period_end?: number | null;
  canceled_at?: number | null;
};
type BillingData = {
  id?: string;
  status?: string;
  payer?: BillingPayer;
  items?: BillingItem[]; // present on subscription.* events
  plan?: BillingPlan; // present on subscriptionItem.* events (the data IS the item)
  period_end?: number | null;
  canceled_at?: number | null;
};

type ClerkEvent = {
  type?: string;
  data?: {
    id?: string;
    email_addresses?: Array<{ email_address?: string }>;
  } & BillingData;
};

const isBillingEvent = (type: string) =>
  type.startsWith("subscription") || type.startsWith("subscriptionItem");

// Resolve, from a billing event, whether the user should have Pro and the derived display
// fields. Returns null when the event doesn't concern the 'pro' plan at all (e.g. an item for
// a different plan) so we leave their flag untouched.
function resolveProState(
  type: string,
  data: BillingData
): { subscribed: boolean; planName?: string; renewsAt?: string } | null {
  // subscription.* events carry an items[] array; find the 'pro' item.
  // subscriptionItem.* events ARE the item (plan at data.plan).
  let item: BillingItem | undefined;
  if (Array.isArray(data.items)) {
    item = data.items.find((i) => i.plan?.slug === PRO_PLAN_SLUG);
  } else if (data.plan?.slug !== undefined) {
    item = data.plan?.slug === PRO_PLAN_SLUG ? data : undefined;
  } else {
    // No plan info on the payload. Fall back to the subscription-level status so a
    // top-level subscription.* event can still revoke on a terminal status.
    item = data;
  }
  if (!item) return null;

  // Prefer the item status; fall back to the subscription-level status.
  const status = (item.status || data.status || "").toLowerCase();

  // A *.canceled / *.ended / *.expired event type is authoritative for revocation even if a
  // stale status string lags behind.
  const terminalEvent =
    type === "subscriptionItem.canceled" ||
    type === "subscriptionItem.ended" ||
    type === "subscriptionItem.expired" ||
    type === "subscription.canceled"; // defensive; Clerk has no such event today

  let subscribed: boolean;
  if (terminalEvent || TERMINAL_STATUSES.has(status)) subscribed = false;
  else if (ACTIVE_STATUSES.has(status)) subscribed = true;
  else if (status === "canceled") subscribed = false; // term ended
  else return null; // upcoming / incomplete / unknown — leave access unchanged

  const planName = item.plan?.name;
  const renewsAt =
    item.period_end != null ? new Date(item.period_end * 1000).toISOString() : undefined;
  return { subscribed, planName, renewsAt };
}

async function handleBilling(event: ClerkEvent): Promise<NextResponse> {
  const type = event.type || "";
  const data = (event.data || {}) as BillingData;
  const userId = data.payer?.user_id;
  // B2C only — we never grant Pro to an organization payer here.
  if (!userId) return NextResponse.json({ ok: true, ignored: true, reason: "no-user-payer" });

  const state = resolveProState(type, data);
  if (!state) return NextResponse.json({ ok: true, ignored: true, reason: "not-pro-plan" });

  try {
    const cc = await clerkClient();
    const user = await cc.users.getUser(userId).catch(() => null);
    if (!user) return NextResponse.json({ ok: true, ignored: true, reason: "no-account" });

    // MERGE — never clobber other publicMetadata keys (adminTier, comp, role, …). Clear the
    // renews date on revoke. planName mirrors the Clerk plan for display only.
    const next: Record<string, unknown> = {
      ...user.publicMetadata,
      subscribed: state.subscribed,
    };
    if (state.subscribed) {
      if (state.planName) next.planName = state.planName;
      next.renewsAt = state.renewsAt;
    } else {
      next.renewsAt = undefined;
    }
    await cc.users.updateUserMetadata(userId, { publicMetadata: next });

    await logAudit({
      actor: "clerk-billing",
      action: state.subscribed ? "billing_grant" : "billing_revoke",
      target: user.primaryEmailAddress?.emailAddress ?? userId,
      detail: `${type} plan=${PRO_PLAN_SLUG} status=${(data.status || "").toString()} sub=${data.id ?? ""}`,
    });
    return NextResponse.json({ ok: true, updated: 1, subscribed: state.subscribed });
  } catch {
    return new NextResponse("Update failed", { status: 500 });
  }
}

async function handleUserDeleted(event: ClerkEvent): Promise<NextResponse> {
  const userId = event.data?.id;
  if (!userId || !sql) return NextResponse.json({ ok: true, ignored: true });

  try {
    // Resolve any emails tied to this user so we can also purge email-keyed rows (newsletter
    // sign-ups with no clerk_user_id, and the Pro download log). The user.deleted payload may
    // carry email_addresses; we also pull any email stored against the clerk_user_id.
    const emails = new Set<string>();
    for (const ea of event.data?.email_addresses ?? []) {
      const e = ea?.email_address?.trim().toLowerCase();
      if (e) emails.add(e);
    }
    try {
      const erows = (await sql.query(
        `SELECT email FROM subscribers WHERE clerk_user_id = $1 AND email IS NOT NULL`,
        [userId]
      )) as Record<string, unknown>[];
      for (const r of erows) { const e = String(r.email).trim().toLowerCase(); if (e) emails.add(e); }
    } catch { /* table absent — ignore */ }

    // Cascade-delete the user's own data on account deletion. The Clerk user lives outside our
    // DB, so there is no FK to cascade from — we purge their rows here. api_keys is included so a
    // deleted account's API key can no longer authenticate. The track record (scored_results /
    // open_calls) is keyed by report, not user, so it is untouched; admin_audit_log is preserved.
    // Clerk Billing handles subscription teardown itself, so there is no LS sub to cancel here.
    for (const t of ["watchlists", "push_subscriptions", "subscribers", "feedback", "api_keys"]) {
      try { await sql.query(`DELETE FROM ${t} WHERE clerk_user_id = $1`, [userId]); }
      catch { /* table absent on an un-migrated DB — ignore */ }
    }
    // Email-keyed rows: newsletter sign-ups with no clerk_user_id, and the Pro download log.
    for (const email of emails) {
      try { await sql.query(`DELETE FROM subscribers WHERE email = $1`, [email]); } catch { /* ignore */ }
      try { await sql.query(`DELETE FROM download_log WHERE user_id = $1`, [email]); } catch { /* ignore */ }
    }

    // Record every account deletion (incl. admins) so removals are auditable. Admin access
    // via ADMIN_EMAILS survives deletion: re-signing-up with the same email restores it, so
    // deleting an admin account never permanently locks you out of the dashboard.
    await logAudit({
      actor: "clerk",
      action: "user_deleted",
      target: userId,
      detail: `account deleted; data purged (incl. api_keys${emails.size ? `, ${emails.size} email(s)` : ""})`,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return new NextResponse("Cleanup failed", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.CLERK_WEBHOOK_SECRET || "";
  const ok = verifyClerkWebhook(
    raw,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    secret
  );
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  let event: ClerkEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  const type = event.type || "";
  if (isBillingEvent(type)) return handleBilling(event);
  if (type === "user.deleted") return handleUserDeleted(event);
  return NextResponse.json({ ok: true, ignored: true });
}
