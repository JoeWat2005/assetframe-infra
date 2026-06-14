"use server";
import { currentUser } from "@clerk/nextjs/server";
import { signCheckoutToken } from "@/lib/checkout-token";
import { getEntitlement } from "@/lib/entitlements";
import { SITE } from "@/site.config";

// Build the Lemon Squeezy checkout URL with a SIGNED token binding it to the signed-in
// Clerk account, so the webhook grants Pro to exactly that account no matter what email is
// entered at checkout. Generated server-side so the signing secret never reaches the client.
export async function getCheckoutUrl(): Promise<{ url: string | null; reason?: string }> {
  const base = SITE.checkoutUrl;
  if (!base) return { url: null, reason: "unconfigured" };

  // Authoritative guard: admins get Pro comped, so they must NEVER create a paid subscription
  // — even while previewing the free tier (where a Subscribe button is visible). This covers
  // both role-based and ADMIN_EMAILS admins, and every entry point (pricing, reader, account).
  const ent = await getEntitlement();
  if (!ent.signedIn) return { url: null, reason: "signed-out" };
  if (ent.admin) return { url: null, reason: "admin" };
  if (ent.billingActive) return { url: null, reason: "already-subscribed" };

  const user = await currentUser();
  if (!user) return { url: null, reason: "signed-out" };
  try {
    const u = new URL(base);
    u.searchParams.set("checkout[custom][token]", signCheckoutToken(user.id));
    const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
    if (email) u.searchParams.set("checkout[email]", email); // prefill only (UX); the token is authoritative
    return { url: u.toString() };
  } catch {
    return { url: base };
  }
}
