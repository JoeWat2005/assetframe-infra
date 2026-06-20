import "server-only";
import { sql } from "./db";
import { getEngineHeartbeat } from "./upstash";

// Server-only data layer for the admin Engine console. Mirrors lib/content.ts / lib/audit.ts:
// every read guards for `sql` being null (DB not configured / tables not migrated yet) and
// degrades to safe defaults, so the page renders before the migration is applied.

// How fresh the VM's heartbeat must be for the instance to count as online. The engine
// heartbeats into engine_state.last_heartbeat_at on a short loop; if it lapses past this
// window the instance is treated as offline (scheduled + manual runs won't execute).
const HEARTBEAT_WINDOW_SEC = 180;

export type EngineState = {
  automationPaused: boolean;
  lastHeartbeatAt: string | null; // ISO string, or null if never seen
  currentRunId: string | null;
  updatedAt: string | null;
  online: boolean; // derived: heartbeat within HEARTBEAT_WINDOW_SEC of now
};

export type GenerationRequest = {
  id: string;
  requestedBy: string;
  scope: unknown; // {"assets":[...]} | {"all_due":true}
  status: string; // queued | running | done | failed | cancelled
  cancelRequested: boolean;
  runId: string;
  error: string;
  createdAt: string; // "YYYY-MM-DD HH:MI" UTC
  startedAt: string;
  finishedAt: string;
};

export type EngineRun = {
  id: string;
  trigger: string; // schedule | manual
  scope: unknown;
  status: string; // running | done | failed
  results: unknown; // per-asset manifest summary
  errors: string;
  logExcerpt: string;
  startedAt: string; // "YYYY-MM-DD HH:MI" UTC
  finishedAt: string;
};

// A box-control command (restart/pull/maintenance/logs/config) the admin enqueues for the OCI VM.
// The poller claims it from engine_commands and runs an allow-listed handler; result/logExcerpt
// carry the outcome back. Mirrors GenerationRequest — a second web->box channel.
export type EngineCommand = {
  id: string;
  command: string; // restart_poller | pull_latest | run_maintenance | tail_logs | set_config
  args: unknown;
  status: string; // queued | running | done | failed | cancelled
  requestedBy: string;
  cancelRequested: boolean;
  result: string; // short outcome / error summary
  logExcerpt: string; // tail of command output (e.g. tail_logs)
  createdAt: string; // "YYYY-MM-DD HH:MI" UTC
  startedAt: string;
  finishedAt: string;
};

const s = (v: unknown): string => (v == null ? "" : String(v));

// Default singleton when the DB / table isn't there yet: paused=false, offline (no heartbeat).
const DEFAULT_STATE: EngineState = {
  automationPaused: false,
  lastHeartbeatAt: null,
  currentRunId: null,
  updatedAt: null,
  online: false,
};

// The engine_state singleton (id=1), plus a derived `online` boolean. Computes `online` in SQL
// (now() - last_heartbeat_at) so it doesn't depend on web/VM clock skew beyond the DB's own clock.
export async function getEngineState(): Promise<EngineState> {
  if (!sql) return DEFAULT_STATE;
  // The poller now heartbeats into Upstash (so the Neon compute can auto-suspend); read that for
  // "online", keeping the Neon heartbeat as a fallback so the indicator still works during the
  // transition or if Upstash is unset. paused + current_run still live in Neon (read here on the
  // admin page load — not a hot path).
  const upstashHb = await getEngineHeartbeat().catch(() => null);
  const upstashOnline =
    !!upstashHb && Date.now() - new Date(upstashHb).getTime() < HEARTBEAT_WINDOW_SEC * 1000;
  try {
    const rows = (await sql.query(
      `SELECT automation_paused,
              last_heartbeat_at::text AS last_heartbeat_at,
              current_run_id,
              updated_at::text AS updated_at,
              (last_heartbeat_at IS NOT NULL
                AND last_heartbeat_at > now() - make_interval(secs => $1)) AS online
         FROM engine_state WHERE id = 1 LIMIT 1`,
      [HEARTBEAT_WINDOW_SEC]
    )) as Record<string, unknown>[];
    const r = rows[0];
    if (!r) return { ...DEFAULT_STATE, online: upstashOnline, lastHeartbeatAt: upstashHb };
    const neonHb = r.last_heartbeat_at == null ? null : s(r.last_heartbeat_at);
    return {
      automationPaused: Boolean(r.automation_paused),
      lastHeartbeatAt: upstashHb ?? neonHb, // prefer Upstash (the engine's primary source now)
      currentRunId: r.current_run_id == null ? null : s(r.current_run_id),
      updatedAt: r.updated_at == null ? null : s(r.updated_at),
      online: Boolean(r.online) || upstashOnline,
    };
  } catch {
    // Neon read failed — still report online from Upstash if its heartbeat is fresh.
    return { ...DEFAULT_STATE, online: upstashOnline, lastHeartbeatAt: upstashHb };
  }
}

// Recent generation requests (the queue + its history), newest first.
export async function getGenerationRequests(limit = 20): Promise<GenerationRequest[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT id, coalesce(requested_by, '') AS requested_by, scope, status,
              cancel_requested, coalesce(run_id, '') AS run_id, coalesce(error, '') AS error,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at,
              to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS started_at,
              to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS finished_at
         FROM generation_requests
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: s(r.id),
      requestedBy: s(r.requested_by),
      scope: r.scope ?? null,
      status: s(r.status),
      cancelRequested: Boolean(r.cancel_requested),
      runId: s(r.run_id),
      error: s(r.error),
      createdAt: s(r.created_at),
      startedAt: s(r.started_at),
      finishedAt: s(r.finished_at),
    }));
  } catch {
    return [];
  }
}

// Recent engine runs (the OC instance logs), newest first.
export async function getEngineRuns(limit = 20): Promise<EngineRun[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT id, trigger, scope, status, results, coalesce(errors, '') AS errors,
              coalesce(log_excerpt, '') AS log_excerpt,
              to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS started_at,
              to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS finished_at
         FROM engine_runs
        ORDER BY started_at DESC
        LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: s(r.id),
      trigger: s(r.trigger),
      scope: r.scope ?? null,
      status: s(r.status),
      results: r.results ?? null,
      errors: s(r.errors),
      logExcerpt: s(r.log_excerpt),
      startedAt: s(r.started_at),
      finishedAt: s(r.finished_at),
    }));
  } catch {
    return [];
  }
}

// Recent box-control commands (the engine_commands queue + history), newest first. Returns []
// when the table isn't migrated yet (so the admin page renders before migration 1750000020000).
export async function getEngineCommands(limit = 20): Promise<EngineCommand[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT id, command, args, status, coalesce(requested_by, '') AS requested_by,
              cancel_requested, coalesce(result, '') AS result, coalesce(log_excerpt, '') AS log_excerpt,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at,
              to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS started_at,
              to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS finished_at
         FROM engine_commands
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: s(r.id),
      command: s(r.command),
      args: r.args ?? null,
      status: s(r.status),
      requestedBy: s(r.requested_by),
      cancelRequested: Boolean(r.cancel_requested),
      result: s(r.result),
      logExcerpt: s(r.log_excerpt),
      createdAt: s(r.created_at),
      startedAt: s(r.started_at),
      finishedAt: s(r.finished_at),
    }));
  } catch {
    return [];
  }
}
