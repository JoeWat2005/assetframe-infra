import type { GenerationRequest, EngineRun, EngineCommand } from "@/lib/engine";
import CancelButton from "./CancelButton";

// Server-rendered tables for the Engine console (no client JS beyond the Cancel button):
//   - RequestQueue: recent generation_requests with a status pill + Cancel for live rows.
//   - RunLog: recent engine_runs (the OC instance logs) with an expandable error/log excerpt.
//   - CommandLog: recent engine_commands (box-control: restart/pull/maintenance/logs/config) with
//     an expandable result/log excerpt + Cancel for live rows.
// Kept out of page.tsx purely to keep that file readable; all take already-fetched rows.

// Friendly labels for the box-control verbs (keep in sync with actions.ts ENGINE_COMMANDS).
const COMMAND_LABEL: Record<string, string> = {
  restart_poller: "Restart poller",
  pull_latest: "Pull latest + restart",
  run_maintenance: "Re-run publish",
  tail_logs: "Fetch logs",
  set_config: "Set config",
};

// Status pill colours, reusing the same green/amber/red/grey palette as the rest of the admin.
const STATUS_STYLES: Record<string, string> = {
  queued: "bg-tile text-muted-foreground",
  running: "bg-[#fff7e6] text-[#9a6700]",
  done: "bg-[#dafbe1] text-[#1a7f37]",
  failed: "bg-[#ffebe9] text-[#cf222e]",
  cancelled: "bg-tile text-muted-foreground",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-tile text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{status || "—"}</span>;
}

// Render a scope jsonb ({"all_due":true} | {"assets":[...]}) as a short human summary.
function scopeSummary(scope: unknown): string {
  if (scope && typeof scope === "object") {
    const o = scope as Record<string, unknown>;
    if (o.all_due === true) return "all due";
    if (Array.isArray(o.assets)) return o.assets.map(String).join(", ") || "—";
  }
  return "—";
}

const LIVE = new Set(["queued", "running"]);

export function RequestQueue({ rows }: { rows: GenerationRequest[] }) {
  if (rows.length === 0) {
    return <p className="px-6 pb-2 text-sm text-muted-foreground">No generation requests yet.</p>;
  }
  return (
    <div className="divide-y divide-line border-t border-line">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={r.status} />
              <span className="truncate font-medium text-navy">{scopeSummary(r.scope)}</span>
              {r.cancelRequested && LIVE.has(r.status) && (
                <span className="text-[11px] font-semibold text-[#cf222e]">cancelling…</span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {r.createdAt || "—"}{r.requestedBy ? ` · ${r.requestedBy}` : ""}
              {r.error ? ` · ${r.error}` : ""}
            </div>
          </div>
          {LIVE.has(r.status) && !r.cancelRequested && <CancelButton id={r.id} />}
        </div>
      ))}
    </div>
  );
}

export function RunLog({ rows }: { rows: EngineRun[] }) {
  if (rows.length === 0) {
    return <p className="px-6 pb-2 text-sm text-muted-foreground">No engine runs logged yet.</p>;
  }
  return (
    <div className="divide-y divide-line border-t border-line">
      {rows.map((r) => {
        const detail = [r.errors, r.logExcerpt].filter(Boolean).join("\n\n");
        return (
          <div key={r.id} className="px-6 py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <StatusPill status={r.status} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{r.trigger || "—"}</span>
                <span className="truncate font-medium text-navy">{r.id}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {r.startedAt || "—"}{r.finishedAt ? ` → ${r.finishedAt}` : ""}
              </span>
            </div>
            {detail && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] font-semibold text-navy">
                  {r.errors ? "Error / log" : "Log"}
                </summary>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-tile px-3 py-2 text-[11px] leading-relaxed text-[#33415c]">
                  {detail}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CommandLog({ rows }: { rows: EngineCommand[] }) {
  if (rows.length === 0) {
    return <p className="px-6 pb-2 text-sm text-muted-foreground">No box commands yet.</p>;
  }
  return (
    <div className="divide-y divide-line border-t border-line">
      {rows.map((r) => {
        const detail = [r.result, r.logExcerpt].filter(Boolean).join("\n\n");
        return (
          <div key={r.id} className="px-6 py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <StatusPill status={r.status} />
                <span className="truncate font-medium text-navy">{COMMAND_LABEL[r.command] ?? r.command}</span>
                {r.cancelRequested && LIVE.has(r.status) && (
                  <span className="text-[11px] font-semibold text-[#cf222e]">cancelling…</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {r.createdAt || "—"}{r.finishedAt ? ` → ${r.finishedAt}` : ""}
                  {r.requestedBy ? ` · ${r.requestedBy}` : ""}
                </span>
                {LIVE.has(r.status) && !r.cancelRequested && <CancelButton id={r.id} kind="command" />}
              </div>
            </div>
            {detail && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] font-semibold text-navy">Result / log</summary>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-tile px-3 py-2 text-[11px] leading-relaxed text-[#33415c]">
                  {detail}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
