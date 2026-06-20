"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendEngineCommand, clearCatalog } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Box-control panel for the OCI VM. Enqueues allow-listed commands the poller claims + runs
// (engine_commands). Mirrors GenerateForm's useTransition + inline-message + router.refresh()
// pattern. The web never contacts the box directly — it only writes a queued row; the box polls.
// Destructive verbs (pull/restart) confirm first. Results show in the "Box command log" below.

// Mirrors actions.ts SETTABLE_CONFIG_KEYS / engine_ops._SETTABLE_CONFIG_KEYS (no secrets).
const SETTABLE_KEYS = [
  "ASSETFRAME_AUTHOR_BRIEFS", "ADVISOR_DATA_PROVIDER", "ASSETFRAME_RUN_TIMEOUT",
];

type Result = { ok: boolean; message: string };

export default function BoxControls() {
  const router = useRouter();
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [cfgKey, setCfgKey] = useState(SETTABLE_KEYS[0]);
  const [cfgVal, setCfgVal] = useState("");

  const run = (command: string, args?: Record<string, unknown>, confirmMsg?: string) =>
    start(async () => {
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      try {
        const r = await sendEngineCommand(command, args);
        setMsg(r);
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, message: "Action failed — not authorized?" });
      }
    });

  // For web actions (not box commands) like clearing the Neon catalog.
  const runAction = (fn: () => Promise<Result>, confirmMsg?: string) =>
    start(async () => {
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      try {
        const r = await fn();
        setMsg(r);
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, message: "Action failed — not authorized?" });
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Safe operations — read-only / recoverable, no data loss. */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("run_maintenance")}
          title="Re-run export → publish (R2) → sync (Neon) WITHOUT generating. Recovers a run that generated locally but failed to publish.">
          Re-run publish
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("tail_logs", { lines: 200 })}
          title="Pull the latest ~200 poller log lines into the box command log below.">
          Fetch logs
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("run_scoring")}
          title="Grade any closed prediction windows into the ledger now (no new reports generated).">
          Score now
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("service_check")}
          title="Check the box can reach Neon, R2 and Upstash. Result shows in the Box command log.">
          Service check
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("clear_wake")}
          title="Clear a stuck Upstash wake flag.">
          Clear wake flag
        </Button>
      </div>

      {/* Deploy / restart — a brief outage, no data loss. */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending}
          onClick={() => run("pull_latest", undefined, "Pull the latest code from origin (git pull --ff-only), reinstall deps, and restart the poller onto it. Continue?")}
          title="git fetch + git pull --ff-only + reinstall deps, then restart onto the new code.">
          Pull + restart
        </Button>
        <Button size="sm" variant="outline" disabled={pending}
          onClick={() => run("restart_poller", undefined, "Restart the engine poller now? It self-exits and systemd relaunches it within a few seconds.")}
          title="Gracefully restart the poller (picks up .env changes). systemd relaunches it.">
          Restart poller
        </Button>
      </div>

      {/* set_config: write an allow-listed key to the engine .env (effective on next restart). */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Config key</label>
          <Select value={cfgKey} onValueChange={setCfgKey}>
            <SelectTrigger aria-label="Config key" className="w-full sm:w-[230px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SETTABLE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Input
          aria-label="Config value"
          placeholder="value"
          value={cfgVal}
          onChange={(e) => setCfgVal(e.target.value)}
          className="sm:max-w-[160px]"
        />
        <Button
          size="sm" variant="outline" disabled={pending || !cfgVal.trim()}
          onClick={() => run("set_config", { key: cfgKey, value: cfgVal },
            `Set ${cfgKey}=${cfgVal} in the engine .env? It takes effect on the next restart.`)}
          title="Write an allow-listed key to the engine .env. Takes effect after a restart."
        >
          Set config
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Commands run on the box at its next ~30s poll. <b>Set config</b> changes apply after a{" "}
        <b>Restart</b>; <b>Re-run publish</b> recovers a generated-but-unpublished run. Watch the
        Box command log below for each command&rsquo;s result.
      </p>

      {/* Danger zone — irreversible deletes, visually separated + red so they're never a misclick. */}
      <div className="rounded-lg border border-[#cf222e]/30 bg-[#ffebe9]/40 p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#cf222e]">Danger zone — irreversible</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pending}
            className="border-[#cf222e]/40 text-[#cf222e] hover:bg-[#ffebe9]"
            onClick={() => run("reset_ledger", undefined, "Reset the box's outcome ledger to EMPTY? This clears the track-record source on the box and cannot be undone.")}
            title="Truncate the box's outcome ledger to its header — a fresh track record.">
            Reset ledger
          </Button>
          <Button size="sm" variant="outline" disabled={pending}
            className="border-[#cf222e]/40 text-[#cf222e] hover:bg-[#ffebe9]"
            onClick={() => run("clear_reports", undefined, "Clear ALL working dirs on the box (reports, data, content, runs)? The ledger is NOT touched. Cannot be undone.")}
            title="Clear the box's working dirs (reports/data/content/runs) — a dashboard system refresh, no SSH.">
            Clear reports
          </Button>
          <Button size="sm" variant="outline" disabled={pending}
            className="border-[#cf222e]/40 text-[#cf222e] hover:bg-[#ffebe9]"
            onClick={() => run("clear_r2", undefined, "Delete ALL report files from R2? They'd need re-publishing (Re-run publish, or regenerate). Cannot be undone.")}
            title="Delete report objects from the R2 bucket (the private report files).">
            Clear R2 files
          </Button>
          <Button size="sm" variant="outline" disabled={pending}
            className="border-[#cf222e]/40 text-[#cf222e] hover:bg-[#ffebe9]"
            onClick={() => runAction(clearCatalog, "Clear the public catalog in Neon (all editions + scored results)? Pair with Reset ledger + Clear reports + Clear R2 for a full reset. Cannot be undone.")}
            title="Delete editions + scored results from Neon — the public catalog.">
            Clear catalog (Neon)
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-[#cf222e]/80">A full system reset = all four (box dirs + ledger + R2 files + Neon catalog).</p>
      </div>
      {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
    </div>
  );
}
