"use server";
import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { getEntitlement } from "@/lib/entitlements";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getEngineAssets } from "@/lib/engine-assets";
import { getEngineState } from "@/lib/engine";
import { signalEngineWake } from "@/lib/upstash";
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
  // Edition ids are `<YYYY-MM-DD>/<slug>`. Allow the full real slug charset (incl. '.') so a dotted
  // or edge ticker (e.g. BRK.B) can still be toggled — the engine sanitizes slugs, and the UPDATE is
  // parameterized, so this is just shape validation, not the security boundary.
  if (!/^\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+$/.test(id)) return { ok: false, message: "Bad edition id." };
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

type EngineScope = { all_due: true; as_of?: string } | { assets: string[]; as_of?: string };

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
    // Guard the silent no-op: "All due" with nothing enabled would run + generate zero reports.
    const enabledCount = (await getEngineAssets()).filter((a) => a.enabled).length;
    if (enabledCount === 0) return { ok: false, message: "No assets are enabled — enable at least one in the Asset universe first." };
    normalized = { all_due: true };
    summary = `all due (${enabledCount} enabled)`;
  } else if (scope && "assets" in scope && Array.isArray(scope.assets)) {
    // Match case-insensitively — edition slugs are upper-case (e.g. "ETH"), but the picker/user
    // input may differ in case — while keeping the canonical slug so the engine receives the exact
    // id it published the edition under.
    // Validate against the ASSET UNIVERSE (engine_assets, enabled) — not the published catalog —
    // so you can generate an instrument before its first edition exists. The engine runs
    // `--asset <id>`, so we pass the lowercase asset ids.
    const known = new Map((await getEngineAssets()).filter((a) => a.enabled).map((a) => [a.id.toLowerCase(), a.id] as const));
    const requested = [...new Set(scope.assets.map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
    const assets = requested.map((a) => known.get(a)).filter((s): s is string => Boolean(s));
    const unknown = requested.filter((a) => !known.has(a));
    if (assets.length === 0) return { ok: false, message: "Select at least one enabled asset." };
    if (unknown.length) return { ok: false, message: `Unknown or disabled asset(s): ${unknown.join(", ")}.` };
    normalized = { assets };
    summary = assets.join(", ");
  } else {
    return { ok: false, message: "Bad scope." };
  }

  // Optional BACKDATE (as-of): generate for a past time so the prediction window is already closed
  // — used to test scoring/the ledger immediately. Accept "YYYY-MM-DDTHH:MM" or with a space.
  const asOfRaw = (scope as { as_of?: string })?.as_of;
  if (typeof asOfRaw === "string" && asOfRaw.trim()) {
    const v = asOfRaw.trim().replace("T", " ").slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return { ok: false, message: "Bad backdate — pick a valid date/time." };
    normalized.as_of = v;
    summary += ` as-of ${v} UTC`;
  }

  try {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO generation_requests (id, requested_by, scope, status)
       VALUES ($1, $2, $3::jsonb, 'queued')`,
      [id, ent.email ?? null, JSON.stringify(normalized)]
    );
    await logAudit({ actor: ent.email, action: "engine_request", target: id, detail: summary });
    // Wake the OCI poller now (via Upstash) so it picks the request up on its next ~30s tick
    // instead of waiting for its periodic Neon safety sweep. Best-effort — the row is queued either way.
    await signalEngineWake();
    // Be honest if the box is offline — the row is queued either way, but it won't run until the
    // engine reconnects (otherwise a green "Queued" looks like it's generating when nothing is).
    const online = (await getEngineState().catch(() => ({ online: true }))).online;
    return {
      ok: true,
      message: online
        ? `Queued a run for ${summary}.`
        : `Queued for ${summary} — but the engine is OFFLINE, so it won't run until the box reconnects.`,
      id,
    };
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

// ------------------------------------------------------------ Box control (engine_commands)
// A SECOND web->box channel: allow-listed COMMANDS the OCI poller claims + runs (restart, pull
// latest, re-run the publish chain, fetch logs, set an allow-listed config value). Like generation
// requests, we only WRITE a queued row here — the box polls + executes. The allow-list is enforced
// on BOTH sides; the box (engine_ops.run_command) is the real security boundary and never runs an
// unknown verb. Keep this list in sync with engine_ops.ALLOWED_COMMANDS in the assetframe-scripts repo.
const ENGINE_COMMANDS: Record<string, string> = {
  restart_poller: "Restart poller",
  pull_latest: "Pull latest + restart",
  run_maintenance: "Re-run publish (export → R2 → Neon)",
  tail_logs: "Fetch recent logs",
  set_config: "Set config value",
  sync_assets: "Sync asset universe to the box",
  reset_ledger: "Reset the outcome ledger",
  clear_reports: "Clear working dirs (system refresh)",
  run_scoring: "Score closed windows now",
  compute_due: "Check which assets are due",
  service_check: "Health-check Neon / R2 / Upstash",
  clear_r2: "Clear report files from R2",
  clear_wake: "Clear the Upstash wake flag",
  run_backtest: "Run sandbox backtest (isolated, no publish)",
};
// Keys set_config may write to the engine .env. Mirrors engine_ops._SETTABLE_CONFIG_KEYS — only
// keys the engine consumes, never secrets/credentials/URLs. (The box re-validates this list too.)
const SETTABLE_CONFIG_KEYS = [
  "ASSETFRAME_AUTHOR_BRIEFS", "ADVISOR_DATA_PROVIDER", "ASSETFRAME_RUN_TIMEOUT", "ASSETFRAME_BRIEF_MODEL",
  "ASSETFRAME_RETENTION_DAYS",
];

// Enqueue an allow-listed box command. Validates the verb + args, inserts a 'queued'
// engine_commands row, and wakes the poller. The box claims it on its next ~30s tick.
export async function sendEngineCommand(
  command: string,
  args?: Record<string, unknown>
): Promise<{ ok: boolean; message: string; id?: string }> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  if (!(command in ENGINE_COMMANDS)) return { ok: false, message: "Unknown command." };

  // Rate-limit per admin — these can restart/redeploy the box. No-op until Upstash is set.
  const rl = await rateLimit(`engine:command:${ent.email ?? "admin"}`, { limit: 20, windowSec: 60 });
  if (!rl.ok) return { ok: false, message: "Too many commands — please slow down." };

  // Validate + normalise per-command args (defence in depth; the box re-validates and is the boundary).
  let cleanArgs: Record<string, unknown> = {};
  let detail = ENGINE_COMMANDS[command];
  if (command === "set_config") {
    const key = String(args?.key ?? "").trim();
    const value = String(args?.value ?? "");
    if (!SETTABLE_CONFIG_KEYS.includes(key)) return { ok: false, message: "Not a settable config key." };
    if (/[\r\n]/.test(value) || value.length > 200) return { ok: false, message: "Value must be a single line ≤ 200 chars." };
    // Per-key value validation (defence in depth; the box validates + is the boundary). A bad
    // ASSETFRAME_RUN_TIMEOUT is int()-parsed at engine import and would crash-loop the poller.
    if (key === "ASSETFRAME_RUN_TIMEOUT" && !(/^\d+$/.test(value) && Number(value) >= 60 && Number(value) <= 86400)) {
      return { ok: false, message: "ASSETFRAME_RUN_TIMEOUT must be an integer 60–86400 (seconds)." };
    }
    // A brief-model typo would break every brief — require a Claude model id.
    if (key === "ASSETFRAME_BRIEF_MODEL" && !/^claude-[a-z0-9.-]{2,52}$/.test(value)) {
      return { ok: false, message: "ASSETFRAME_BRIEF_MODEL must be a Claude model id (e.g. claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8)." };
    }
    // Local reports/runs retention in days (0 = keep everything). Bounded so a typo can't be wild.
    if (key === "ASSETFRAME_RETENTION_DAYS" && !(/^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 3650)) {
      return { ok: false, message: "ASSETFRAME_RETENTION_DAYS must be an integer 0–3650 (days; 0 = keep everything)." };
    }
    cleanArgs = { key, value };
    detail = `${key}=${value}`;
  } else if (command === "tail_logs") {
    const n = Number(args?.lines);
    cleanArgs = { lines: Number.isFinite(n) ? Math.max(20, Math.min(1000, Math.round(n))) : 200 };
  } else if (command === "run_backtest") {
    // Sandbox backtest: generate the picked assets backdated to as_of, score into a SEPARATE
    // sandbox ledger, never publish. Validate the assets against the enabled universe (same as
    // requestGeneration) and require a backdated as_of so the window is already closed. The box
    // re-validates and is the real boundary; this is defence in depth.
    const rawAssets = Array.isArray(args?.assets) ? args!.assets : [];
    const known = new Map((await getEngineAssets()).filter((a) => a.enabled).map((a) => [a.id.toLowerCase(), a.id] as const));
    const requested = [...new Set(rawAssets.map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
    const assets = requested.map((a) => known.get(a)).filter((s): s is string => Boolean(s));
    const unknown = requested.filter((a) => !known.has(a));
    if (assets.length === 0) return { ok: false, message: "Select at least one enabled asset to backtest." };
    if (unknown.length) return { ok: false, message: `Unknown or disabled asset(s): ${unknown.join(", ")}.` };
    // as_of is REQUIRED — a backtest needs a window that has already closed. Accept
    // "YYYY-MM-DDTHH:MM" or with a space (same shape as the generation backdate).
    const v = String(args?.as_of ?? "").trim().replace("T", " ").slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return { ok: false, message: "Pick a valid as-of date/time (a few days ago)." };
    cleanArgs = { assets, as_of: v };
    detail = `${assets.join(", ")} as-of ${v} UTC`;
  }

  try {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO engine_commands (id, command, args, requested_by, status)
       VALUES ($1, $2, $3::jsonb, $4, 'queued')`,
      [id, command, JSON.stringify(cleanArgs), ent.email ?? null]
    );
    await logAudit({ actor: ent.email, action: `engine_cmd_${command}`, target: id, detail });
    await signalEngineWake();
    return { ok: true, message: `Queued: ${ENGINE_COMMANDS[command]}.`, id };
  } catch {
    return { ok: false, message: "Couldn't queue the command — has the engine-commands migration been applied?" };
  }
}

// Co-operatively cancel a queued/running box command (mostly relevant for queued ones — the box
// runs commands quickly and doesn't interrupt a running handler).
export async function cancelEngineCommand(id: string): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  const cleaned = (id || "").trim();
  if (!cleaned) return { ok: false, message: "Bad command id." };
  try {
    const rows = (await sql.query(
      `UPDATE engine_commands SET cancel_requested = true
        WHERE id = $1 AND status IN ('queued','running')
        RETURNING id`,
      [cleaned]
    )) as Record<string, unknown>[];
    if (rows.length === 0) return { ok: false, message: "Nothing to cancel — already finished?" };
    await logAudit({ actor: ent.email, action: "engine_cmd_cancel", target: cleaned, detail: "cancellation requested" });
    return { ok: true, message: "Cancellation requested." };
  } catch {
    return { ok: false, message: "Couldn't request cancellation." };
  }
}

// ------------------------------------------------------------ Asset universe (engine_assets)
// The admin-editable list of WHAT the engine generates reports for. Every mutation writes
// engine_assets (the dashboard's source of truth) and enqueues a `sync_assets` box command so the
// box rewrites config/assets.json — but only after the engine's config_loader validates it. Enum
// values mirror scripts/config_loader.py; the engine re-validates, so this is the convenience copy.
const ASSET_CLASSES = ["equity", "crypto", "fx", "futures", "index", "commodity"];
const SESSION_PROFILES = ["fx_spot", "crypto_24_7", "us_equity_rth", "cme_futures"];
const CADENCES = ["daily", "weekday", "trading_day", "weekday_or_market_open", "weekly", "monthly"];
const FORECAST_WINDOWS = ["next_liquid_session", "next_regular_session", "rolling_24h", "next_session", "next_week", "next_5_sessions"];
const PUBLISH_POLICIES = ["approval_required", "auto"];
const REPORT_TIERS = ["official", "watchlist", "staged", "backtest"];
const TIMEZONES = [
  "UTC", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Australia/Sydney",
  "Europe/Zurich", "Europe/Frankfurt", "Europe/Paris",
];

type AssetInput = {
  id: string; name: string; instrument: string; ticker: string; yahoo: string; eodhd?: string;
  assetClass: string; sessionProfile: string; cadence: string; timezone: string;
  rollUtc?: number; related?: string; forecastWindow?: string; publishPolicy?: string;
  reportTier?: string; enabled?: boolean;
  cadenceDay?: string; timeframes?: string[];
  includeFundamentals?: boolean | null; includeNews?: boolean; fundamentalsSource?: string;
};

// Push config/assets.json on the box up to date with engine_assets (validated box-side).
async function enqueueSyncAssets(): Promise<void> {
  if (!sql) return;
  try {
    await sql.query(
      `INSERT INTO engine_commands (id, command, args, requested_by, status)
       VALUES ($1, 'sync_assets', '{}'::jsonb, $2, 'queued')`,
      [randomUUID(), "asset-edit"]
    );
    await signalEngineWake();
  } catch {
    /* engine_commands not migrated yet */
  }
}

export async function upsertEngineAsset(input: AssetInput): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  const id = (input.id || "").trim().toLowerCase();
  const ticker = (input.ticker || "").trim().toUpperCase();
  const yahoo = (input.yahoo || "").trim();
  if (!/^[a-z0-9_]+$/.test(id)) return { ok: false, message: "id must be lowercase letters/numbers/underscore." };
  if (!ticker) return { ok: false, message: "ticker is required." };
  if (!yahoo) return { ok: false, message: "Yahoo symbol is required (the price feed)." };
  if (!input.name?.trim() || !input.instrument?.trim()) return { ok: false, message: "name and instrument are required." };
  if (!ASSET_CLASSES.includes(input.assetClass)) return { ok: false, message: "Invalid asset class." };
  if (!SESSION_PROFILES.includes(input.sessionProfile)) return { ok: false, message: "Invalid session profile." };
  if (!CADENCES.includes(input.cadence)) return { ok: false, message: "Invalid cadence." };
  if (!TIMEZONES.includes(input.timezone)) return { ok: false, message: "Invalid timezone." };
  const publishPolicy = PUBLISH_POLICIES.includes(input.publishPolicy ?? "") ? input.publishPolicy! : "approval_required";
  const forecastWindow = FORECAST_WINDOWS.includes(input.forecastWindow ?? "") ? input.forecastWindow! : "next_session";
  const reportTier = REPORT_TIERS.includes(input.reportTier ?? "") ? input.reportTier! : "official";
  const roll = Math.max(0, Math.min(23, Math.round(Number(input.rollUtc) || 0)));
  const enabled = input.enabled !== false;
  const providerSymbols: Record<string, string> = { yahoo };
  const eodhd = (input.eodhd || "").trim();
  if (eodhd) providerSymbols.eodhd = eodhd;
  // multi-timeframe + per-asset fetch config (mirrors scripts/config_loader.py validation)
  const timeframes = Array.isArray(input.timeframes)
    ? Array.from(new Set(input.timeframes.filter((t) => FORECAST_WINDOWS.includes(t))))
    : [];
  const cadenceDay = ((): string | null => {
    const v = String(input.cadenceDay ?? "").trim().toLowerCase();
    if (!v) return null;
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 6) return String(n);
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(v.slice(0, 3)) ? v.slice(0, 3) : null;
  })();
  const includeNews = input.includeNews !== false;
  const includeFundamentals = input.includeFundamentals == null ? null : Boolean(input.includeFundamentals);
  const fundamentalsSource = ["auto", "twelvedata", "none"].includes(input.fundamentalsSource ?? "")
    ? input.fundamentalsSource! : "auto";
  try {
    await sql.query(
      `INSERT INTO engine_assets (id, name, instrument, ticker, provider_symbols, asset_class, session_profile,
         cadence, timezone, roll_utc, related, forecast_window, publish_policy, report_tier, enabled,
         cadence_day, timeframes, include_fundamentals, include_news, fundamentals_source, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20, now())
       ON CONFLICT (id) DO UPDATE SET name=excluded.name, instrument=excluded.instrument, ticker=excluded.ticker,
         provider_symbols=excluded.provider_symbols, asset_class=excluded.asset_class, session_profile=excluded.session_profile,
         cadence=excluded.cadence, timezone=excluded.timezone, roll_utc=excluded.roll_utc, related=excluded.related,
         forecast_window=excluded.forecast_window, publish_policy=excluded.publish_policy, report_tier=excluded.report_tier,
         enabled=excluded.enabled, cadence_day=excluded.cadence_day, timeframes=excluded.timeframes,
         include_fundamentals=excluded.include_fundamentals, include_news=excluded.include_news,
         fundamentals_source=excluded.fundamentals_source, updated_at=now()`,
      [id, input.name.trim(), input.instrument.trim(), ticker, JSON.stringify(providerSymbols), input.assetClass,
       input.sessionProfile, input.cadence, input.timezone, roll, (input.related || "").trim(),
       forecastWindow, publishPolicy, reportTier, enabled,
       cadenceDay, JSON.stringify(timeframes), includeFundamentals, includeNews, fundamentalsSource]
    );
    await logAudit({ actor: ent.email, action: "asset_upsert", target: id, detail: `${ticker} (${input.assetClass})` });
    await enqueueSyncAssets();
    return { ok: true, message: `Saved ${ticker} — syncing to the engine.` };
  } catch {
    return { ok: false, message: "Couldn't save — has the engine-assets migration been applied?" };
  }
}

export async function deleteEngineAsset(id: string): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  const cleaned = (id || "").trim().toLowerCase();
  if (!cleaned) return { ok: false, message: "Bad id." };
  try {
    await sql.query(`DELETE FROM engine_assets WHERE id = $1`, [cleaned]);
    await logAudit({ actor: ent.email, action: "asset_delete", target: cleaned, detail: "removed from universe" });
    await enqueueSyncAssets();
    return { ok: true, message: `Removed ${cleaned} — syncing.` };
  } catch {
    return { ok: false, message: "Delete failed." };
  }
}

export async function setAssetEnabled(id: string, enabled: boolean): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  const cleaned = (id || "").trim().toLowerCase();
  if (!cleaned) return { ok: false, message: "Bad id." };
  try {
    await sql.query(`UPDATE engine_assets SET enabled = $2, updated_at = now() WHERE id = $1`, [cleaned, enabled]);
    await logAudit({ actor: ent.email, action: enabled ? "asset_enable" : "asset_disable", target: cleaned, detail: enabled ? "in daily universe" : "out of daily universe" });
    await enqueueSyncAssets();
    return { ok: true, message: `${cleaned} ${enabled ? "enabled" : "disabled"}.` };
  } catch {
    return { ok: false, message: "Update failed." };
  }
}

// Clear the public catalog in Neon — deletes editions (cascades to open_calls + predictions) and
// the scored_results. The Neon side of a full reset (pair with the box's clear_reports + reset_ledger).
// Destructive; the UI confirms. Does NOT touch R2 files (use clear_r2) or the engine_assets universe.
export async function clearCatalog(): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  try {
    await sql.query(`DELETE FROM scored_results`);
    await sql.query(`DELETE FROM editions`); // cascades to open_calls -> open_call_predictions
    await logAudit({ actor: ent.email, action: "clear_catalog", target: "neon", detail: "editions + scored cleared" });
    revalidateTag("content", "max");
    return { ok: true, message: "Catalog cleared (editions, open calls, scored results)." };
  } catch {
    return { ok: false, message: "Couldn't clear the catalog." };
  }
}

// Global approval toggle — set EVERY asset's publish_policy. require=true => approval_required
// (you approve each report); false => auto (reports publish straight away when generated).
export async function setRequireApproval(requireApproval: boolean): Promise<Result> {
  const ent = await requireAdmin();
  if (!sql) return { ok: false, message: "Database not configured." };
  const policy = requireApproval ? "approval_required" : "auto";
  try {
    await sql.query(`UPDATE engine_assets SET publish_policy = $1, updated_at = now()`, [policy]);
    await logAudit({ actor: ent.email, action: "asset_approval_mode", target: "all", detail: policy });
    await enqueueSyncAssets();
    return { ok: true, message: requireApproval ? "New reports now require your approval." : "New reports will auto-publish." };
  } catch {
    return { ok: false, message: "Update failed." };
  }
}
