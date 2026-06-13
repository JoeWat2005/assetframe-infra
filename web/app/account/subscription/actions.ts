"use server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { cancelLemonSubscription, type CancelResult } from "@/lib/lemonsqueezy";

/**
 * Cancel the signed-in user's own subscription. Reads the Lemon Squeezy subscription
 * id from their Clerk metadata (set by the webhook), cancels via the LS API, and
 * optimistically marks the status cancelled — the webhook reconciles authoritatively.
 */
export async function cancelMySubscription(): Promise<CancelResult> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "no-subscription" };

  const meta = (user.publicMetadata || {}) as { subscriptionId?: string };
  if (!meta.subscriptionId) return { ok: false, reason: "no-subscription" };

  const result = await cancelLemonSubscription(meta.subscriptionId);
  if (result.ok) {
    try {
      const cc = await clerkClient();
      await cc.users.updateUserMetadata(user.id, {
        publicMetadata: { ...user.publicMetadata, subStatus: result.status },
      });
    } catch {
      /* the webhook will reconcile status shortly */
    }
    revalidatePath("/account/subscription");
  }
  return result;
}
