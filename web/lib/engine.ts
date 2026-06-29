import "server-only";
import { sql } from "./db";
import { getEngineHeartbeat } from "./upstash";
import type {
  EngineState,
  GenerationRequest,
  EngineRunResults,
  EngineRun,
  EngineCommand,
  BacktestResult,
  BacktestPrediction,
} from "./engine-types";

// Re-export the engine console's data types from their dedicated module so existing importers
// (e.g. `import { EngineState, getEngineState } from "@/lib/engine"`) keep resolving unchanged.
export type {
  EngineState,
  GenerationRequest,
  EngineRunAsset,
  EngineRunResults,
  EngineRun,
  EngineCommand,
  BacktestResult,
  BacktestPrediction,
} from "./engine-types";

// Server-only data layer for the admin Engine console. Mirrors lib/content.ts / lib/audit.ts:
// every read guards for `sql` being null (DB not configured / tables not migrated yet) and
// degrades to safe defaults, so the page renders before the migration is applied.

// How fresh the VM's heartbeat must be for the instance to count as online. The engine
// heartbeats into engine_state.last_heartbeat_at on a short loop; if it lapses past this
// window the instance is treated as offline (scheduled + manual runs won't execute).
const HEARTBEAT_WINDOW_SEC = 180;

const s = (v: unknown): string => (v == null ? "" : String(v));
const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
      // jsonb summary written by the engine; tolerate null (older runs) and the old/unknown shape.
      results: (r.results ?? null) as EngineRunResults | null,
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

// Recent SANDBOX BACKTEST results (admin-only), newest window first. Returns [] when the DB / table
// isn't there yet, so the admin page renders before the backtest_results migration is applied. This
// is test data only — the public site never reads it.
export async function getBacktestResults(limit = 300): Promise<BacktestResult[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT report_id, coalesce(ticker, '') AS ticker, coalesce(instrument, '') AS instrument,
              coalesce(asset_class, '') AS asset_class, coalesce(view, '') AS view,
              confidence, coalesce(horizon, '') AS horizon, coalesce(window_end, '') AS window_end,
              coalesce(results, '') AS results, coalesce(hits, 0) AS hits, coalesce(misses, 0) AS misses,
              hit_rate, coalesce(scored_at, '') AS scored_at,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at
         FROM backtest_results
        ORDER BY window_end DESC
        LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      reportId: s(r.report_id),
      ticker: s(r.ticker),
      instrument: s(r.instrument),
      assetClass: s(r.asset_class),
      view: s(r.view),
      confidence: numOrNull(r.confidence),
      horizon: s(r.horizon),
      windowEnd: s(r.window_end),
      results: s(r.results),
      hits: Number(r.hits) || 0,
      misses: Number(r.misses) || 0,
      hitRate: numOrNull(r.hit_rate),
      scoredAt: s(r.scored_at),
      createdAt: s(r.created_at),
    }));
  } catch {
    return [];
  }
}

// The full per-prediction list for every sandbox backtest result, keyed to backtest_results.report_id
// (admin-only). Ordered by report_id then sort so the BacktestResults card can group + render each
// report's predictions in engine order. Returns [] when the DB / table isn't there yet (so the admin
// page renders before the backtest_predictions migration is applied). Test data only — never public.
export async function getBacktestPredictions(limit = 5000): Promise<BacktestPrediction[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT report_id, coalesce(pred_id, '') AS pred_id, coalesce(ptype, '') AS ptype,
              coalesce(ptext, '') AS ptext, coalesce(manual, false) AS manual,
              outcome, coalesce(sort, 0) AS sort
         FROM backtest_predictions
        ORDER BY report_id, sort
        LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      reportId: s(r.report_id),
      predId: s(r.pred_id),
      ptype: s(r.ptype),
      ptext: s(r.ptext),
      manual: Boolean(r.manual),
      outcome: r.outcome == null ? null : s(r.outcome),
      sort: Number(r.sort) || 0,
    }));
  } catch {
    return [];
  }
}
