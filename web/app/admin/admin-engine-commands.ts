"use server";
import { randomUUID } from "node:crypto";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getEngineAssets } from "@/lib/engine-assets";
import { signalEngineWake } from "@/lib/upstash";
import { sql } from "@/lib/db";
import { controlEligible, boxControl } from "@/lib/control-client";
import { requireAdmin } from "./admin-auth";
import type { Result } from "@/lib/admin-types";

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
  clear_sandbox: "Clear sandbox (reset the box's backtest sim trees)",
};
// Keys set_config may write to the engine .env. Mirrors engine_ops._SETTABLE_CONFIG_KEYS — only
// keys the engine consumes, never secrets/credentials/URLs. (The box re-validates this list too.)
const SETTABLE_CONFIG_KEYS = [
  "ASSETFRAME_AUTHOR_BRIEFS", "ADVISOR_DATA_PROVIDER", "ASSETFRAME_DATA_LICENSE", "ASSETFRAME_RUN_TIMEOUT",
  "ASSETFRAME_BRIEF_MODEL", "ASSETFRAME_RETENTION_DAYS", "ASSETFRAME_BRIEF_BATCH", "ASSETFRAME_CRITIC_MODEL",
  "ASSETFRAME_BRIEF_CONCURRENCY", "ASSETFRAME_BRIEF_WEB_MAX_USES", "TWELVEDATA_RATE_PER_MIN",
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
    // Enum keys — mirror the engine allow-list exactly (the box re-validates and is the boundary).
    if (key === "ASSETFRAME_AUTHOR_BRIEFS" && value !== "0" && value !== "1") {
      return { ok: false, message: "ASSETFRAME_AUTHOR_BRIEFS must be 0 (you write briefs) or 1 (AI writes them)." };
    }
    if (key === "ADVISOR_DATA_PROVIDER" && !["yahoo", "twelvedata", "eodhd", "coingecko"].includes(value)) {
      return { ok: false, message: "ADVISOR_DATA_PROVIDER must be one of: yahoo, twelvedata, eodhd, coingecko." };
    }
    if (key === "ASSETFRAME_DATA_LICENSE" && value !== "personal" && value !== "commercial") {
      return { ok: false, message: "ASSETFRAME_DATA_LICENSE must be personal or commercial." };
    }
    // Per-key value validation (defence in depth; the box validates + is the boundary). A bad
    // ASSETFRAME_RUN_TIMEOUT is int()-parsed at engine import and would crash-loop the poller.
    if (key === "ASSETFRAME_RUN_TIMEOUT" && !(/^\d+$/.test(value) && Number(value) >= 60 && Number(value) <= 86400)) {
      return { ok: false, message: "ASSETFRAME_RUN_TIMEOUT must be an integer 60–86400 (seconds)." };
    }
    // A brief/critic-model typo would break every brief — require a Claude model id.
    if ((key === "ASSETFRAME_BRIEF_MODEL" || key === "ASSETFRAME_CRITIC_MODEL") && !/^claude-[a-z0-9.-]{2,52}$/.test(value)) {
      return { ok: false, message: `${key} must be a Claude model id (e.g. claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8).` };
    }
    // Batch authoring toggle (1 = Message Batches path; 0 = synchronous).
    if (key === "ASSETFRAME_BRIEF_BATCH" && value !== "0" && value !== "1") {
      return { ok: false, message: "ASSETFRAME_BRIEF_BATCH must be 0 (synchronous) or 1 (batch)." };
    }
    // Concurrent briefs on the synchronous path (1 = safe on Anthropic Tier 1).
    if (key === "ASSETFRAME_BRIEF_CONCURRENCY" && !(/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 16)) {
      return { ok: false, message: "ASSETFRAME_BRIEF_CONCURRENCY must be an integer 1–16." };
    }
    // Web searches per news-on brief (input-cost dial).
    if (key === "ASSETFRAME_BRIEF_WEB_MAX_USES" && !(/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 15)) {
      return { ok: false, message: "ASSETFRAME_BRIEF_WEB_MAX_USES must be an integer 1–15 (web searches per brief)." };
    }
    // Local reports/runs retention in days (0 = keep everything). Bounded so a typo can't be wild.
    if (key === "ASSETFRAME_RETENTION_DAYS" && !(/^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 3650)) {
      return { ok: false, message: "ASSETFRAME_RETENTION_DAYS must be an integer 0–3650 (days; 0 = keep everything)." };
    }
    // Twelve Data requests/min throttle (0 = no throttle). Mirrors the engine's 0–1000 bound.
    if (key === "TWELVEDATA_RATE_PER_MIN" && !(/^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= 1000)) {
      return { ok: false, message: "TWELVEDATA_RATE_PER_MIN must be an integer 0–1000 (API requests/min; 0 = no throttle)." };
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
    // Optional multi-day sweep: 1 = just the as-of day; >1 walks back day-by-day, generating a
    // full report each day. Coerce to an int and clamp 1..90 so a bad value can't run forever.
    const daysNum = Math.round(Number(args?.days));
    const days = Number.isFinite(daysNum) ? Math.max(1, Math.min(90, daysNum)) : 1;
    cleanArgs = { assets, as_of: v, days };
    detail = `${assets.join(", ")} as-of ${v} UTC${days > 1 ? ` ×${days}d` : ""}`;
  }

  // Control-plane cutover (flag-gated). When the box HTTP control server is configured and the
  // command is HTTP-eligible (restart_poller/pull_latest stay on the poller path), deliver it
  // INSTANTLY over the Cloudflare Tunnel instead of the ~30s Neon poll. On any box failure we fall
  // through to the durable Neon queue below, so this is safe to enable incrementally. → control-plane.md
  if (controlEligible(command)) {
    const r = await boxControl(command, cleanArgs);
    if (r.ok) {
      await logAudit({ actor: ent.email, action: `engine_cmd_${command}`, target: r.id ?? "control-api", detail: `${detail} (control API)` }).catch(() => {});
      return { ok: true, message: `${ENGINE_COMMANDS[command]} — sent to the box.`, id: r.id };
    }
    // box unreachable / rejected -> fall through to the durable Neon path (nothing queued yet, so no double-send)
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
