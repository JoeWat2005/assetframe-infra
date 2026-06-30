import "server-only";
import { boxStatus } from "./control-client";
import type { EngineState, EngineRun, EngineRunResults, GenerationRequest, EngineCommand } from "./engine-types";

// THE CUTOVER read model: the whole admin engine console, sourced from the box /status over the
// Cloudflare Tunnel instead of direct Neon reads — so Neon can sleep when nobody is watching. Returns
// null when the control plane is unconfigured or the box is unreachable; the page then falls back to
// the Neon readers in lib/engine.ts. Box snapshot shape: control_server.snapshot().

export type ScheduleRow = {
  id: string;
  assetClass: string;
  cadence: string;
  dueNow: boolean;
  nextDueAt: string | null; // ISO, or null if not due within the horizon
};

export type EngineConsole = {
  state: EngineState;
  requests: GenerationRequest[];
  runs: EngineRun[];
  commands: EngineCommand[];
  schedule: ScheduleRow[];
};

const s = (v: unknown): string => (v == null ? "" : String(v));
// Box ISO timestamp -> "YYYY-MM-DD HH:MM" UTC, matching the Neon readers' to_char format.
const ts = (v: unknown): string => (v == null ? "" : String(v).replace("T", " ").slice(0, 16));
const rows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];

export async function getEngineConsoleFromBox(): Promise<EngineConsole | null> {
  const snap = await boxStatus();
  if (!snap) return null;

  const state: EngineState = {
    automationPaused: Boolean(snap.paused),
    lastHeartbeatAt: snap.last_heartbeat_at == null ? null : s(snap.last_heartbeat_at),
    currentRunId: snap.current_run_id == null ? null : s(snap.current_run_id),
    updatedAt: snap.now == null ? null : s(snap.now),
    online: Boolean(snap.online),
  };

  const requests: GenerationRequest[] = rows(snap.requests).map((r) => ({
    id: s(r.id), requestedBy: s(r.requested_by), scope: r.scope ?? null, status: s(r.status),
    cancelRequested: Boolean(r.cancel_requested), runId: s(r.run_id), error: s(r.error),
    createdAt: ts(r.created_at), startedAt: ts(r.started_at), finishedAt: ts(r.finished_at),
  }));

  const runs: EngineRun[] = rows(snap.runs).map((r) => ({
    id: s(r.id), trigger: s(r.trigger), scope: r.scope ?? null, status: s(r.status),
    results: (r.results as EngineRunResults | null) ?? null, errors: s(r.errors), logExcerpt: s(r.log_excerpt),
    startedAt: ts(r.started_at), finishedAt: ts(r.finished_at),
  }));

  // Box command jobs (the HTTP control log). No requestedBy/cancel on a box job; result + log map across.
  const commands: EngineCommand[] = rows(snap.commands).map((c) => ({
    id: s(c.id), command: s(c.command), args: c.args ?? null, status: s(c.status),
    requestedBy: "", cancelRequested: false, result: s(c.result), logExcerpt: s(c.log),
    createdAt: ts(c.created_at), startedAt: "", finishedAt: ts(c.finished_at),
  }));

  const schedule: ScheduleRow[] = rows(snap.schedule).map((a) => ({
    id: s(a.id), assetClass: s(a.asset_class), cadence: s(a.cadence),
    dueNow: Boolean(a.due_now), nextDueAt: a.next_due_at == null ? null : s(a.next_due_at),
  }));

  return { state, requests, runs, commands, schedule };
}
