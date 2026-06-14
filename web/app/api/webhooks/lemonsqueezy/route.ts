import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { verifyLemonSignature, subscriptionStateFromEvent } from "@/lib/lemonsqueezy";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Attrs = {
  user_email?: string;
  status?: string;
  variant_name?: string;
  product_name?: string;
  variant_id?: string | number;
  product_id?: string | number;
  customer_id?: string | number;
  updated_at?: string;
  renews_at?: string | null;
  ends_at?: string | null;
  urls?: { customer_portal?: string; update_payment_method?: string };
};
type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>;

function primaryEmail(u: ClerkUser): string | undefined {
  return u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress;
}
// Only credit a Clerk account whose VERIFIED primary email equals the signature-verified
// payer email — blocks granting Pro to an arbitrary/victim account via a forged user_id.
function isVerifiedPayer(u: ClerkUser, email: string): boolean {
  const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId);
  return (
    !!primary &&
    primary.emailAddress.toLowerCase() === email &&
    primary.verification?.status === "verified"
  );
}

// Optional product/variant allow-list: only these LS variant ids grant Pro (so an unrelated
// product on the same store can't). Empty/unset = allow all (single-product MVP default).
const ALLOWED_VARIANTS = (process.env.LEMONSQUEEZY_VARIANT_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Lemon Squeezy subscription webhook.
 *  1. verify the HMAC signature over the RAW body (reject forgeries),
 *  2. map event+status to a subscribed boolean (refunds/chargebacks force revoke),
 *  3. resolve the account: by the durable subscription→user mapping (so revokes/refunds
 *     work even after an email change), else by the VERIFIED payer email for a first grant,
 *  4. drop stale/replayed events, then write Clerk metadata + upsert the mapping + audit.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("X-Signature");
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";
  if (!verifyLemonSignature(raw, signature, secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: { id?: string | number; attributes?: Attrs };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  const eventName = event.meta?.event_name ?? "";
  const attrs = event.data?.attributes ?? {};
  const email = attrs.user_email?.toLowerCase();
  const hintUserId = event.meta?.custom_data?.user_id; // a hint only — must match the payer
  const subscribed = subscriptionStateFromEvent(eventName, attrs.status);
  if (subscribed === null) return NextResponse.json({ ok: true, ignored: true });

  // Product allow-list (no-op unless LEMONSQUEEZY_VARIANT_IDS is set).
  if (ALLOWED_VARIANTS.length) {
    const vid = attrs.variant_id != null ? String(attrs.variant_id) : "";
    if (!vid || !ALLOWED_VARIANTS.includes(vid)) {
      return NextResponse.json({ ok: true, ignored: true, reason: "other-product" });
    }
  }

  const subscriptionId = event.data?.id != null ? String(event.data.id) : undefined;
  const eventAt = attrs.updated_at ?? ""; // ISO; used for staleness
  const customerId = attrs.customer_id != null ? String(attrs.customer_id) : undefined;

  const patch: Record<string, unknown> = { subscribed };
  if (subscriptionId) patch.subscriptionId = subscriptionId;
  if (customerId) patch.lsCustomerId = customerId;
  if (attrs.urls?.customer_portal) patch.portalUrl = attrs.urls.customer_portal;
  if (attrs.status) patch.subStatus = attrs.status;
  if (attrs.variant_name || attrs.product_name) patch.planName = attrs.variant_name || attrs.product_name;
  if (attrs.renews_at !== undefined) patch.renewsAt = attrs.renews_at;
  if (attrs.ends_at !== undefined) patch.endsAt = attrs.ends_at;
  if (eventAt) patch.subUpdatedAt = eventAt;

  try {
    const cc = await clerkClient();

    // 1) Prefer the durable mapping — authoritative for every later event including revokes.
    let mappedUserId: string | null = null;
    let mappedUpdatedAt: string | null = null;
    if (sql && subscriptionId) {
      try {
        const rows = (await sql.query(
          `SELECT clerk_user_id, updated_at FROM billing_subscriptions WHERE subscription_id = $1`,
          [subscriptionId]
        )) as Record<string, unknown>[];
        if (rows[0]) {
          mappedUserId = String(rows[0].clerk_user_id);
          mappedUpdatedAt = rows[0].updated_at ? String(rows[0].updated_at) : null;
        }
      } catch {
        /* table not migrated yet → fall back to email binding */
      }
    }

    // Idempotency / out-of-order: skip events not newer than the last applied for this sub.
    if (mappedUserId && eventAt && mappedUpdatedAt && eventAt <= mappedUpdatedAt) {
      return NextResponse.json({ ok: true, skipped: "stale" });
    }

    // 2) Resolve the target user object.
    let user: ClerkUser | null = null;
    if (mappedUserId) {
      user = await cc.users.getUser(mappedUserId).catch(() => null);
    } else if (email) {
      if (hintUserId) {
        const u = await cc.users.getUser(hintUserId).catch(() => null);
        if (u && isVerifiedPayer(u, email)) user = u;
      }
      if (!user) {
        const { data: users } = await cc.users.getUserList({ emailAddress: [email] });
        user = users.find((u) => isVerifiedPayer(u, email)) ?? null; // single account, no fan-out
      }
    }

    if (!user) {
      // A grant we couldn't bind (unverified email, or paid with a different email) — log it
      // so it's observable/recoverable rather than a silent drop.
      if (subscribed === true) {
        await logAudit({
          actor: "webhook", action: "grant_unresolved",
          target: email ?? subscriptionId ?? "?",
          detail: `${eventName} status=${attrs.status ?? ""} sub=${subscriptionId ?? ""}`,
        });
      }
      return NextResponse.json({ ok: true, ignored: true, reason: "no-account" });
    }

    // 3) Apply: Clerk metadata, durable mapping, audit.
    await cc.users.updateUserMetadata(user.id, { publicMetadata: { ...user.publicMetadata, ...patch } });

    if (sql && subscriptionId) {
      try {
        await sql.query(
          `INSERT INTO billing_subscriptions (subscription_id, ls_customer_id, clerk_user_id, status, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (subscription_id) DO UPDATE SET
             ls_customer_id = COALESCE(excluded.ls_customer_id, billing_subscriptions.ls_customer_id),
             clerk_user_id  = excluded.clerk_user_id,
             status         = excluded.status,
             updated_at     = COALESCE(excluded.updated_at, billing_subscriptions.updated_at)`,
          [subscriptionId, customerId ?? null, user.id, attrs.status ?? null, eventAt || null]
        );
      } catch {
        /* mapping persistence is best-effort */
      }
    }

    await logAudit({
      actor: "webhook",
      action: subscribed ? "billing_grant" : "billing_revoke",
      target: primaryEmail(user) ?? email ?? user.id,
      detail: `${eventName} status=${attrs.status ?? ""} sub=${subscriptionId ?? ""}`,
    });

    return NextResponse.json({ ok: true, updated: 1, subscribed });
  } catch {
    return new NextResponse("Update failed", { status: 500 });
  }
}
