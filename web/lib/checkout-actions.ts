"use server";
import { currentUser } from "@clerk/nextjs/server";
import { signCheckoutToken } from "@/lib/checkout-token";
import { SITE } from "@/site.config";

// Build the Lemon Squeezy checkout URL with a SIGNED token binding it to the signed-in
// Clerk account, so the webhook grants Pro to exactly that account no matter what email is
// entered at checkout. Generated server-side so the signing secret never reaches the client.
export async function getCheckoutUrl(): Promise<{ url: string | null }> {
  const base = SITE.checkoutUrl;
  if (!base) return { url: null };
  const user = await currentUser();
  try {
    const u = new URL(base);
    if (user) {
      u.searchParams.set("checkout[custom][token]", signCheckoutToken(user.id));
      const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
      if (email) u.searchParams.set("checkout[email]", email); // prefill only (UX); the token is authoritative
    }
    return { url: u.toString() };
  } catch {
    return { url: base };
  }
}
