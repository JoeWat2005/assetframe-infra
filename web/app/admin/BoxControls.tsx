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
  "ASSETFRAME_AUTHOR_BRIEFS", "ADVISOR_DATA_PROVIDER", "ASSETFRAME_DATA_LICENSE", "ASSETFRAME_RUN_TIMEOUT",
  "ASSETFRAME_BRIEF_MODEL", "ASSETFRAME_RETENTION_DAYS", "ASSETFRAME_BRIEF_BATCH", "ASSETFRAME_CRITIC_MODEL",
  "ASSETFRAME_BRIEF_CONCURRENCY", "ASSETFRAME_BRIEF_WEB_MAX_USES",
];
// One-line help shown under the value box when a key is selected, so the operator knows the shape.
const CONFIG_KEY_HINTS: Record<string, string> = {
  ASSETFRAME_AUTHOR_BRIEFS: "1 = the AI writes the research briefs (needs ANTHROPIC_API_KEY); 0 = you write them.",
  ADVISOR_DATA_PROVIDER: "Price feed: yahoo (default, keyless), twelvedata (Grow plan, needs TWELVEDATA_API_KEY), eodhd (needs EODHD_API_KEY) or coingecko.",
  ASSETFRAME_DATA_LICENSE: "Data license mode (personal | commercial).",
  ASSETFRAME_RUN_TIMEOUT: "Max seconds a daily run may take before it's stopped (60–86400).",
  ASSETFRAME_BRIEF_MODEL: "Claude model for briefs, e.g. claude-sonnet-4-6 / claude-haiku-4-5-20251001.",
  ASSETFRAME_RETENTION_DAYS: "Days of local reports/runs to keep on the box (0 = keep forever). Old editions stay in R2.",
  ASSETFRAME_BRIEF_BATCH: "1 = author + critique all briefs via the Message Batches API (no rate limit, 50% cheaper, scales); 0 = synchronous per-asset (the fallback). Restart the poller after changing.",
  ASSETFRAME_CRITIC_MODEL: "Claude model for the adversarial critic, e.g. claude-haiku-4-5-20251001 (cheap/fast default).",
  ASSETFRAME_BRIEF_CONCURRENCY: "Concurrent briefs on the synchronous path (1 = safe on Anthropic Tier 1; raise on a higher tier). Ignored when batch is on.",
  ASSETFRAME_BRIEF_WEB_MAX_USES: "Web searches per news-on brief (1–15, default 6). Lower = cheaper (less input), higher = deeper research. Does not change the model.",
};

// One box action: a plain-English button with a short caption underneath, so a non-technical
// operator can tell what each control does without hovering for a tooltip.
function Action({ label, desc, onClick, disabled, danger }:
  { label: string; desc: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <div className="flex w-[172px] flex-col gap-1">
      <Button size="sm" variant="outline" disabled={disabled} onClick={onClick}
        className={danger ? "border-[#cf222e]/40 text-[#cf222e] hover:bg-[#ffebe9]" : undefined}>
        {label}
      </Button>
      <span className="text-[10.5px] leading-snug text-muted-foreground">{desc}</span>
    </div>
  );
}

type Result = { ok: boolean; message: string };

// `hideScoreNow` drops the Score-now button when it's already surfaced in the daily-loop section
// (Generate → Score), so it isn't shown twice.
export default function BoxControls({ hideScoreNow = false }: { hideScoreNow?: boolean }) {
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

  // One-click FULL reset — does all four together so you never leave orphaned data by clearing
  // only one (e.g. catalog but not R2/ledger). Neon (clearCatalog) + the three box commands.
  const fullReset = () =>
    start(async () => {
      if (!window.confirm("FULL RESET — delete the Neon catalog AND clear the box's reports, ledger and R2 files? This wipes all generated data and cannot be undone. Continue?")) return;
      try {
        // Clear the Neon catalog FIRST. If that fails, stop — don't half-wipe the box and
        // leave orphaned state (the original foot-gun). Only enqueue the box commands once
        // Neon is clean, then report any that failed to queue (e.g. engine_commands unmigrated)
        // instead of showing a false success.
        const cat = await clearCatalog();
        if (!cat.ok) {
          setMsg({ ok: false, message: `Full reset aborted — catalog clear failed: ${cat.message}. Box left untouched.` });
          return;
        }
        const cmds: [string, Result][] = [];
        for (const cmd of ["clear_reports", "reset_ledger", "clear_r2"] as const) {
          cmds.push([cmd, await sendEngineCommand(cmd)]);
        }
        const failed = cmds.filter(([, r]) => !r.ok).map(([c]) => c);
        setMsg(failed.length === 0
          ? { ok: true, message: "Full reset: catalog cleared in Neon; box clearing reports + ledger + R2 (watch the command log)." }
          : { ok: false, message: `Catalog cleared, but these box commands failed to queue: ${failed.join(", ")}. Re-run them from the Danger zone.` });
        router.refresh();
      } catch {
        setMsg({ ok: false, message: "Full reset failed — not authorized?" });
      }
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Recover & inspect — safe, nothing is deleted. */}
      <div>
        <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-navy/70">Recover &amp; inspect</div>
        <p className="mb-2 text-[11px] text-muted-foreground">Safe — nothing is deleted. Use these if a run got stuck, or just to check on the box.</p>
        <div className="flex flex-wrap gap-3">
          <Action label="Re-publish reports" disabled={pending} onClick={() => run("run_maintenance")}
            desc="Re-upload the latest reports to R2 + database. Use if a run generated but failed to publish." />
          {!hideScoreNow && (
            <Action label="Score now" disabled={pending} onClick={() => run("run_scoring")}
              desc="Grade any prediction windows that have closed into the ledger. Makes no new reports." />
          )}
          <Action label="Fetch recent logs" disabled={pending} onClick={() => run("tail_logs", { lines: 200 })}
            desc="Pull the latest ~200 engine log lines into the command log below." />
          <Action label="Check services" disabled={pending} onClick={() => run("service_check")}
            desc="Verify the box can reach the database, R2 and Upstash." />
          <Action label="Clear wake flag" disabled={pending} onClick={() => run("clear_wake")}
            desc="Clear a stuck wake flag if a scheduled run won't start." />
        </div>
      </div>

      {/* Deploy & restart — brief downtime, no data loss. */}
      <div>
        <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-navy/70">Deploy &amp; restart</div>
        <p className="mb-2 text-[11px] text-muted-foreground">A few seconds of downtime, no data loss.</p>
        <div className="flex flex-wrap gap-3">
          <Action label="Deploy latest code" disabled={pending}
            onClick={() => run("pull_latest", undefined, "Deploy the latest code (git pull --ff-only), reinstall dependencies, and restart the engine onto it. Continue?")}
            desc="Pull the newest code from GitHub, reinstall, and restart the engine onto it." />
          <Action label="Restart engine" disabled={pending}
            onClick={() => run("restart_poller", undefined, "Restart the engine poller now? It relaunches within a few seconds.")}
            desc="Restart the poller — e.g. to pick up a setting you changed below." />
        </div>
      </div>

      {/* Change a setting — write one allow-listed key to the engine .env (effective on next restart). */}
      <div>
        <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-navy/70">Change a setting</div>
        <p className="mb-2 text-[11px] text-muted-foreground">Write one engine setting. Takes effect after the next <b>Restart engine</b>.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Setting</label>
            <Select value={cfgKey} onValueChange={setCfgKey}>
              <SelectTrigger aria-label="Setting" className="w-full sm:w-[230px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>{SETTABLE_KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Input aria-label="Value" placeholder="value" value={cfgVal} onChange={(e) => setCfgVal(e.target.value)} className="sm:max-w-[160px]" />
          <Button size="sm" variant="outline" disabled={pending || !cfgVal.trim()}
            onClick={() => run("set_config", { key: cfgKey, value: cfgVal },
              `Set ${cfgKey}=${cfgVal} in the engine settings? It takes effect on the next restart.`)}>
            Save setting
          </Button>
        </div>
        {CONFIG_KEY_HINTS[cfgKey] && (
          <p className="mt-1.5 text-[11px] text-muted-foreground"><b>{cfgKey}</b> — {CONFIG_KEY_HINTS[cfgKey]}</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Everything here runs on the box at its next ~30-second check-in — watch the <b>Box command log</b> below for each result.
      </p>

      {/* Danger zone — irreversible deletes, visually separated + red so they're never a misclick. */}
      <div className="rounded-lg border border-[#cf222e]/30 bg-[#ffebe9]/40 p-3">
        <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-[#cf222e]">Danger zone — irreversible</div>
        <p className="mb-2 text-[11px] text-[#cf222e]/80">These permanently delete generated data. Each asks you to confirm first.</p>
        <div className="flex flex-wrap gap-3">
          <Action danger label="Reset ledger" disabled={pending}
            onClick={() => run("reset_ledger", undefined, "Reset the box's outcome ledger to EMPTY? This clears the track record on the box and cannot be undone.")}
            desc="Empty the track-record ledger on the box (a fresh start)." />
          <Action danger label="Clear reports" disabled={pending}
            onClick={() => run("clear_reports", undefined, "Clear ALL working dirs on the box (reports, data, content, runs)? The ledger is NOT touched. Cannot be undone.")}
            desc="Delete the box's working files (reports, data, runs). Ledger untouched." />
          <Action danger label="Clear R2 files" disabled={pending}
            onClick={() => run("clear_r2", undefined, "Delete ALL report files from R2? They'd need re-publishing (Re-publish reports, or regenerate). Cannot be undone.")}
            desc="Delete all published report files from R2 storage." />
          <Action danger label="Clear catalog" disabled={pending}
            onClick={() => runAction(clearCatalog, "Clear the public catalog in the database (all editions + scored results)? Pair with the other three for a full reset. Cannot be undone.")}
            desc="Delete all editions + scored results from the database." />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending} className="bg-[#cf222e] text-white hover:bg-[#a01b23]" onClick={fullReset}>
            Full reset (everything)
          </Button>
          <span className="text-[11px] text-[#cf222e]/80">One click = database catalog + box files + ledger + R2, all together (no orphans left behind).</span>
        </div>
      </div>
      {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
    </div>
  );
}
