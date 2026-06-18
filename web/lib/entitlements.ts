import "server-only";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { computeEntitlement, SIGNED_OUT, type Entitlement, type PublicMeta } from "./access";

export type { Entitlement } from "./access";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Single source of truth for access. Subscription + admin role live in Clerk
 * user publicMetadata (set by the Lemon Squeezy webhook / Clerk dashboard).
 * Admins implicitly get subscriber access. Falls back to an env email allowlist
 * so you can grant yourself admin before wiring metadata. Pure derivation lives in
 * lib/access.ts (computeEntitlement) so the business logic is unit-tested.
 */
export async function getEntitlement(): Promise<Entitlement> {
  const user = await currentUser();
  if (!user) return SIGNED_OUT;
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  return computeEntitlement((user.publicMetadata || {}) as PublicMeta, email, ADMIN_EMAILS);
}

/**
 * Look up a Clerk user by ID and derive their entitlement. Used by the API-key
 * auth path where the session cookie is not available (Bearer token replaces it).
 * Returns SIGNED_OUT if the user is not found or Clerk is unavailable.
 */
export async function getEntitlementForUserId(clerkUserId: string): Promise<Entitlement> {
  try {
    const cc = await clerkClient();
    const user = await cc.users.getUser(clerkUserId);
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    return computeEntitlement((user.publicMetadata || {}) as PublicMeta, email, ADMIN_EMAILS);
  } catch {
    return SIGNED_OUT;
  }
}
