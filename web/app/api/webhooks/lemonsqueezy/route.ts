import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { verifyLemonSignature, subscriptionStateFromEvent } from "@/lib/lemonsqueezy";

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy subscription webhook. We:
 *  1. read the RAW body and verify the HMAC signature (reject forgeries),
 *  2. map the event to a subscribed boolean,
 *  3. find the Clerk user by email and set publicMetadata.subscribed.
 * Always returns 200 for accepted-but-irrelevant events so LS doesn't retry forever.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("X-Signature");
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";

  if (!verifyLemonSignature(raw, signature, secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: {
    meta?: { event_name?: string };
    data?: {
      id?: string | number;
      attributes?: {
        user_email?: string;
        status?: string;
        variant_name?: string;
        product_name?: string;
        renews_at?: string | null;
        ends_at?: string | null;
        urls?: { customer_portal?: string; update_payment_method?: string };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  const eventName = event.meta?.event_name ?? "";
  const attrs = event.data?.attributes ?? {};
  const email = attrs.user_email?.toLowerCase();
  const subscribed = subscriptionStateFromEvent(eventName, attrs.status);

  if (!email || subscribed === null) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Stash the details the billing page needs (id to cancel via API, portal URL as a
  // fallback, plus human-readable status/plan/renewal). All public-safe.
  const patch: Record<string, unknown> = { subscribed };
  if (event.data?.id != null) patch.subscriptionId = String(event.data.id);
  if (attrs.urls?.customer_portal) patch.portalUrl = attrs.urls.customer_portal;
  if (attrs.status) patch.subStatus = attrs.status;
  if (attrs.variant_name || attrs.product_name) patch.planName = attrs.variant_name || attrs.product_name;
  if (attrs.renews_at !== undefined) patch.renewsAt = attrs.renews_at;
  if (attrs.ends_at !== undefined) patch.endsAt = attrs.ends_at;

  try {
    const cc = await clerkClient();
    const { data: users } = await cc.users.getUserList({ emailAddress: [email] });
    for (const u of users) {
      await cc.users.updateUserMetadata(u.id, {
        publicMetadata: { ...u.publicMetadata, ...patch },
      });
    }
    return NextResponse.json({ ok: true, updated: users.length, subscribed });
  } catch {
    // Don't leak internals; signal a retry to Lemon Squeezy.
    return new NextResponse("Update failed", { status: 500 });
  }
}
