"use server";
import { revalidateTag } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { getEntitlement } from "@/lib/entitlements";
import { logAudit } from "@/lib/audit";

// Every action re-checks admin server-side — never trust the client to gate this.
async function requireAdmin() {
  const ent = await getEntitlement();
  if (!ent.admin) throw new Error("Not authorized");
  return ent;
}

// Grant or revoke Pro for a member by email. Writes Clerk publicMetadata.subscribed
// (the same flag the Lemon Squeezy webhook sets), audits it, then busts the cached stats.
export async function setPro(
  email: string,
  subscribed: boolean
): Promise<{ ok: boolean; message: string }> {
  const ent = await requireAdmin();
  const cleaned = (email || "").trim().toLowerCase();
  if (!cleaned || !cleaned.includes("@")) return { ok: false, message: "Enter a valid email." };
  try {
    const cc = await clerkClient();
    const list = await cc.users.getUserList({ emailAddress: [cleaned], limit: 1 });
    const user = list.data[0];
    if (!user) return { ok: false, message: `No member found for ${cleaned}.` };
    await cc.users.updateUserMetadata(user.id, {
      publicMetadata: { ...(user.publicMetadata || {}), subscribed },
    });
    await logAudit({
      actor: ent.email, action: subscribed ? "grant_pro" : "revoke_pro",
      target: cleaned, detail: "admin dashboard",
    });
    revalidateTag("content", "max");
    return { ok: true, message: `${subscribed ? "Granted" : "Revoked"} Pro for ${cleaned}.` };
  } catch {
    return { ok: false, message: "Clerk request failed — is Clerk configured?" };
  }
}

// Force-refresh the content cache (catalog, track record, admin stats).
export async function revalidateContent(): Promise<{ ok: boolean; message: string }> {
  const ent = await requireAdmin();
  revalidateTag("content", "max");
  await logAudit({ actor: ent.email, action: "revalidate", target: "content", detail: "manual cache bust" });
  return { ok: true, message: "Cleared the content cache — stats, catalog and track record will refresh." };
}

// Search members by email or name (Clerk query). Returns up to 20 with their Pro status.
export async function searchMembers(
  query: string
): Promise<{ ok: boolean; members?: { id: string; email: string; subscribed: boolean }[]; message?: string }> {
  await requireAdmin();
  const q = (query || "").trim();
  if (!q) return { ok: true, members: [] };
  try {
    const cc = await clerkClient();
    const { data } = await cc.users.getUserList({ query: q, limit: 20 });
    return {
      ok: true,
      members: data.map((u) => ({
        id: u.id,
        email: u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.id,
        subscribed: (u.publicMetadata as { subscribed?: boolean })?.subscribed === true,
      })),
    };
  } catch {
    return { ok: false, message: "Clerk search failed — is Clerk configured?" };
  }
}
