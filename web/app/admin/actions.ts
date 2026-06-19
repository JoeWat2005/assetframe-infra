"use server";
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { getEntitlement } from "@/lib/entitlements";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getAllEditions } from "@/lib/content";
import { sql } from "@/lib/db";

type Result = { ok: boolean; message: string };

// Every action re-checks admin server-side — never trust the client to gate this.
async function requireAdmin() {
  const ent = await getEntitlement();
  if (!ent.admin) throw new Error("Not authorized");
  return ent;
}

// Grant or revoke a COMP (complimentary Pro) for a member by email — just flips the
// publicMetadata.subscribed flag. This is for comps only: a real *paid* Clerk Billing
// subscriber should be refunded/cancelled in the Clerk dashboard (Clerk Billing owns the
// subscription lifecycle and will reconcile the flag back via the billing webhook). Clearing
// the flag here would only be overwritten on the subscriber's next billing event.
export async function setPro(email: string, subscribed: boolean): Promise<Result> {
  const ent = await requireAdmin();
  const cleaned = (email || "").trim().toLowerCase();
  if (!cleaned || !cleaned.includes("@")) return { ok: false, message: "Enter a valid email." };
  try {
    const cc = await clerkClient();
    const list = await cc.users.getUserList({ emailAddress: [cleaned], limit: 1 });
    const user = list.data[0];
    if (!user) return { ok: false, message: `No member found for ${cleaned}.` };
    const m = user.publicMetadata || {};

    // Comp toggle — flip the flag, merging the rest of publicMetadata. On revoke we also clear
    // the billing display fields (subStatus / planName / renews / ends / trial / notified) so a
    // stale paid flag left over from the Lemon Squeezy era is fully wiped, not just hidden. A
    // real *paid* Clerk Billing subscriber should be cancelled in the Clerk dashboard instead —
    // their next billing event would re-set these anyway.
    const next: Record<string, unknown> = { ...m, subscribed };
    if (!subscribed) {
      for (const k of ["subStatus", "planName", "renewsAt", "endsAt", "trialEndsAt", "subscriptionId", "notified", "lsCustomerId", "portalUrl"]) {
        next[k] = undefined;
      }
    }
    await cc.users.updateUserMetadata(user.id, { publicMetadata: next });
    await logAudit({
      actor: ent.email, action: subscribed ? "grant_pro" : "revoke_pro",
      target: cleaned, detail: subscribed ? "comp Pro (no charge)" : "removed Pro",
    });
    revalidateTag("content", "max");
    return { ok: true, message: `${subscribed ? "Granted" : "Revoked"} Pro for ${cleaned}.` };
  } catch {
    return { ok: false, message: "Clerk request failed — is Clerk configured?" };
  }
}

// Let an admin preview the product as Pro or Free without paying (admins get Pro by default).
export async function setMyAdminTier(tier: "pro" | "free"): Promise<Result> {
  const ent = await requireAdmin();
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Not signed in." };
    const cc = await clerkClient();
    await cc.users.updateUserMetadata(user.id, {
      publicMetadata: { ...(user.publicMetadata || {}), adminTier: tier },
    });
    await logAudit({ actor: ent.email, action: "admin_tier", target: ent.email ?? user.id, detail: `preview as ${tier}` });
    return { ok: true, message: `Now previewing the ${tier === "free" ? "Free" : "Pro"} tier.` };
  } catch {
    return { ok: false, message: "Couldn't update — is Clerk configured?" };
  }
}

// Unpublish (hide) or restore an edition. Hidden editions disappear from the public site,
// sitemap and reader, but stay in the DB. The report files in R2 are untouched.
export async function setEditionHidden(id: string, hidden: boolean): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  if (!/^\d{4}-\d{2}-\d{2}\/[A-Za-z0-9_-]+$/.test(id)) return { ok: false, message: "Bad edition id." };
  try {
    await sql.query(`UPDATE editions SET hidden = $2 WHERE id = $1`, [id, hidden]);
    await logAudit({
      actor: ent.email, action: hidden ? "unpublish_report" : "publish_report",
      target: id, detail: hidden ? "hidden from the public site" : "restored",
    });
    revalidateTag("content", "max");
    return { ok: true, message: hidden ? `Unpublished ${id}.` : `Restored ${id}.` };
  } catch {
    return { ok: false, message: "Database update failed." };
  }
}

// Force-refresh the content cache (catalog, track record, admin stats).
export async function revalidateContent(): Promise<Result> {
  const ent = await requireAdmin();
  revalidateTag("content", "max");
  await logAudit({ actor: ent.email, action: "revalidate", target: "content", detail: "manual cache bust" });
  return { ok: true, message: "Cleared the content cache — stats, catalog and track record will refresh." };
}

// Move a feedback submission through its lifecycle (new → triaged → planned → done/declined).
const FEEDBACK_STATUSES = ["new", "triaged", "planned", "done", "declined"];
export async function setFeedbackStatus(id: string, status: string): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  if (!FEEDBACK_STATUSES.includes(status)) return { ok: false, message: "Bad status." };
  if (!/^\d+$/.test(id)) return { ok: false, message: "Bad feedback id." };
  try {
    await sql.query(`UPDATE feedback SET status = $2 WHERE id = $1`, [id, status]);
    await logAudit({ actor: ent.email, action: "feedback_status", target: `feedback#${id}`, detail: `→ ${status}` });
    return { ok: true, message: `Marked ${status}.` };
  } catch {
    return { ok: false, message: "Update failed." };
  }
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

// ------------------------------------------------------------------ Engine ops
// These coordinate the Oracle Cloud VM that runs the Python engine. The VM has no inbound
// ports, so we only ever WRITE rows to Neon here — the VM polls them. We never execute the
// engine ourselves (consistent with the no-auto-trading posture: the web app is control-plane).

type EngineScope = { all_due: true } | { assets: string[] };

// Enqueue a generation run. Validates the scope against the known edition slugs, then inserts a
// 'queued' generation_requests row with a fresh uuid. The VM's poller claims it from there.
export async function requestGeneration(
  scope: EngineScope
): Promise<{ ok: boolean; message: string; id?: string }> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };

  // Rate-limit per admin so a stuck client can't flood the queue. No-op until Upstash is set.
  const rl = await rateLimit(`engine:request:${ent.email ?? "admin"}`, { limit: 10, windowSec: 60 });
  if (!rl.ok) return { ok: false, message: "Too many requests — please slow down." };

  // Normalise + validate the scope. Either {all_due:true} or {assets:[...known slugs]}.
  let normalized: EngineScope;
  let summary: string;
  if (scope && "all_due" in scope && scope.all_due === true) {
    normalized = { all_due: true };
    summary = "all due";
  } else if (scope && "assets" in scope && Array.isArray(scope.assets)) {
    // Match case-insensitively — edition slugs are upper-case (e.g. "ETH"), but the picker/user
    // input may differ in case — while keeping the canonical slug so the engine receives the exact
    // id it published the edition under.
    const known = new Map((await getAllEditions()).map((e) => [e.slug.toLowerCase(), e.slug] as const));
    const requested = [...new Set(scope.assets.map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
    const assets = requested.map((a) => known.get(a)).filter((s): s is string => Boolean(s));
    const unknown = requested.filter((a) => !known.has(a));
    if (assets.length === 0) return { ok: false, message: "Select at least one known asset." };
    if (unknown.length) return { ok: false, message: `Unknown asset(s): ${unknown.join(", ")}.` };
    normalized = { assets };
    summary = assets.join(", ");
  } else {
    return { ok: false, message: "Bad scope." };
  }

  try {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO generation_requests (id, requested_by, scope, status)
       VALUES ($1, $2, $3::jsonb, 'queued')`,
      [id, ent.email ?? null, JSON.stringify(normalized)]
    );
    await logAudit({ actor: ent.email, action: "engine_request", target: id, detail: summary });
    return { ok: true, message: `Queued a run for ${summary}.`, id };
  } catch {
    return { ok: false, message: "Couldn't queue the run — has the engine migration been applied?" };
  }
}

// Pause or resume the daily automation (the engine checks this flag before its scheduled run).
export async function setAutomationPaused(paused: boolean): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  try {
    await sql.query(
      `UPDATE engine_state SET automation_paused = $1, updated_at = now() WHERE id = 1`,
      [paused]
    );
    await logAudit({
      actor: ent.email, action: paused ? "engine_pause" : "engine_resume",
      target: "automation", detail: paused ? "daily automation paused" : "daily automation resumed",
    });
    return { ok: true, message: paused ? "Daily automation paused." : "Daily automation resumed." };
  } catch {
    return { ok: false, message: "Couldn't update — has the engine migration been applied?" };
  }
}

// Request cancellation of a queued/running generation. cancel_requested is co-operative: the VM
// checks it and stops at the next safe point (we can't force-kill a process with no inbound ports).
export async function cancelGenerationRequest(id: string): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  const cleaned = (id || "").trim();
  if (!cleaned) return { ok: false, message: "Bad request id." };
  try {
    const rows = (await sql.query(
      `UPDATE generation_requests SET cancel_requested = true
        WHERE id = $1 AND status IN ('queued','running')
        RETURNING id`,
      [cleaned]
    )) as Record<string, unknown>[];
    if (rows.length === 0) return { ok: false, message: "Nothing to cancel — already finished?" };
    await logAudit({ actor: ent.email, action: "engine_cancel", target: cleaned, detail: "cancellation requested" });
    return { ok: true, message: "Cancellation requested." };
  } catch {
    return { ok: false, message: "Couldn't request cancellation." };
  }
}
