import type { EngineState } from "@/lib/engine";
import PauseToggle from "./PauseToggle";

export default function EngineStatusBar({ engineState }: { engineState: EngineState }) {
  return (
        <div className={`rounded-xl px-4 py-3 ring-1 ${engineState.online ? "bg-card ring-foreground/10" : "bg-[#fff5f5] ring-[#cf222e]/40"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                engineState.online ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#ffebe9] text-[#cf222e]"
              }`}
            >
              <span className={`size-2 rounded-full ${engineState.online ? "bg-[#1a7f37]" : "bg-[#cf222e]"}`} />
              {engineState.online ? "Online" : "Offline"}
            </span>
            <span className="text-sm text-muted-foreground">
              Last check-in:{" "}
              <b className="text-navy">
                {engineState.lastHeartbeatAt ? `${engineState.lastHeartbeatAt.replace("T", " ").slice(0, 16)} UTC` : "never"}
              </b>
            </span>
            <span className="text-sm text-muted-foreground">
              Scheduled automation:{" "}
              <b className={engineState.automationPaused ? "text-[#9a6700]" : "text-[#1a7f37]"}>
                {engineState.automationPaused ? "Paused" : "Active"}
              </b>
            </span>
            {engineState.currentRunId && (engineState.online ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-bold text-[#9a6700]">
                <span className="size-2 animate-pulse rounded-full bg-[#9a6700]" />
                Running: {engineState.currentRunId}
              </span>
            ) : (
              // The box hasn't heartbeat within the window — current_run_id is stale (the run can't
              // still be in progress if the engine is offline), so don't show a live "Running" badge.
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tile px-3 py-1 text-xs font-bold text-[#57606a]">
                <span className="size-2 rounded-full bg-[#57606a]" />
                Run {engineState.currentRunId} — offline since {engineState.lastHeartbeatAt ? `${engineState.lastHeartbeatAt.replace("T", " ").slice(0, 16)} UTC` : "never"}
              </span>
            ))}
            <span className="ml-auto"><PauseToggle paused={engineState.automationPaused} /></span>
          </div>
          {!engineState.online && (
            <p className="mt-2 text-xs text-[#cf222e]">
              The box hasn&rsquo;t checked in — scheduled and manual runs won&rsquo;t execute until it&rsquo;s back.
              Open the manual&rsquo;s Troubleshooting, or use <b>Restart engine</b> in <b>Operate the box</b> below.
            </p>
          )}
        </div>
  );
}
