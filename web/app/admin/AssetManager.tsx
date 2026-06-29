"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertEngineAsset, setRequireApproval, sendEngineCommand } from "./actions";
import type { EngineAsset } from "@/lib/engine-assets";
import { Button } from "@/components/ui/button";
import { BLANK, CLASS_DEFAULTS, type Form } from "@/lib/asset-constants";
import { AssetTable } from "./AssetTable";
import { AssetForm } from "./AssetForm";

// Re-export for back-compat — the Form type used to live in this module.
export type { Form } from "@/lib/asset-constants";

type Result = { ok: boolean; message: string };

export default function AssetManager({ assets }: { assets: EngineAsset[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Open the form pre-filled with an existing asset's real settings (edit). Upsert is keyed on id,
  // so saving updates it in place. The id is locked while editing (renaming = delete + re-add).
  const startEdit = (a: EngineAsset) => {
    setForm({
      id: a.id, name: a.name, instrument: a.instrument, ticker: a.ticker,
      yahoo: a.providerSymbols?.yahoo ?? "", eodhd: a.providerSymbols?.eodhd ?? "",
      assetClass: a.assetClass, sessionProfile: a.sessionProfile, cadence: a.cadence,
      timezone: a.timezone, rollUtc: a.rollUtc, related: a.related,
      forecastWindow: a.forecastWindow, publishPolicy: a.publishPolicy,
      reportTier: a.reportTier || "official", enabled: a.enabled,
      cadenceDay: a.cadenceDay, timeframes: a.timeframes, chartIntervals: a.chartIntervals,
      includeFundamentals: a.includeFundamentals ?? (a.assetClass === "equity"), includeNews: a.includeNews,
      fundamentalsSource: a.fundamentalsSource,
    });
    setEditingId(a.id);
    setShowAdd(true);
    setMsg(null);
  };

  const requireApproval = assets.some((a) => a.publishPolicy === "approval_required");
  const mixedApproval = new Set(assets.map((a) => a.publishPolicy)).size > 1;
  const lastChecked = assets.map((a) => a.dueCheckedAt).filter(Boolean).sort().pop() || "";
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  // New assets: derive the internal id from the ticker, and prefill session/timing from the asset
  // class so the Advanced block can stay closed. Editing an existing asset leaves its settings alone.
  const setTicker = (v: string) =>
    setForm((f) => ({ ...f, ticker: v, ...(editingId ? {} : { id: v.toLowerCase().replace(/[^a-z0-9]/g, "") }) }));
  const setClass = (v: string) =>
    setForm((f) => (editingId || !CLASS_DEFAULTS[v] ? { ...f, assetClass: v } : { ...f, assetClass: v, ...CLASS_DEFAULTS[v] }));

  const run = (fn: () => Promise<Result>, confirmMsg?: string) =>
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

  const submitAdd = () =>
    run(async () => {
      const r = await upsertEngineAsset(form);
      if (r.ok) { setForm(BLANK); setShowAdd(false); setEditingId(null); }
      return r;
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Global approval toggle + add */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">New reports <span className="opacity-70">(all assets)</span>:</span>
        <span
          title={mixedApproval ? "Some assets require approval, some auto-publish. Use the toggle to make them all the same, or set per-asset in each row." : undefined}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${mixedApproval ? "bg-tile text-muted-foreground" : requireApproval ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#dafbe1] text-[#1a7f37]"}`}
        >
          {mixedApproval ? "Mixed" : requireApproval ? "Need approval" : "Auto-publish"}
        </span>
        <Button
          size="sm" variant="outline" disabled={pending}
          onClick={() => run(() => setRequireApproval(!requireApproval),
            requireApproval ? "Auto-publish every new report (skip your approval)?" : "Require your approval before any new report goes live?")}
          title="Toggle whether generated reports go live immediately or wait for your approval (sets every asset's publish policy)."
        >
          {requireApproval ? "Switch to auto-publish" : "Require approval"}
        </Button>
        <Button
          size="sm" variant="outline" className="ml-auto" disabled={pending}
          onClick={() => run(() => sendEngineCommand("compute_due"))}
          title="Ask the engine to compute which assets are due to generate now (a dry-run on the box)."
        >
          Check schedule
        </Button>
        <Button size="sm" disabled={pending} onClick={() => { setForm(BLANK); setEditingId(null); setShowAdd((s) => !s); }}>
          {showAdd ? "Close" : "+ Add asset"}
        </Button>
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground">
        The <b>Scheduled</b> column shows what the engine will run on its next due check.{" "}
        {lastChecked ? `Last checked ${lastChecked} UTC.` : "Not checked yet — click Check schedule."}
      </p>
      {mixedApproval && (
        <p className="-mt-1 text-[11px] text-[#9a6700]">
          Your assets currently use <b>different</b> publish policies — the button above sets them all the same; to change just one, use its <b>Edit</b> row.
        </p>
      )}

      {assets.length > 0 && !assets.some((a) => a.enabled) && (
        <p className="rounded-lg border border-[#9a6700]/40 bg-[#fff7e6] px-3 py-2 text-xs text-[#7a5200]">
          ⚠ No assets are enabled — the daily 05:00 run will generate nothing. Enable at least one.
        </p>
      )}

      <AssetTable assets={assets} pending={pending} startEdit={startEdit} run={run} />

      {/* Add / edit form — grouped Basics / Schedule / Horizons / Content / Advanced so it reads
          top-to-bottom and a non-expert can fill only the Basics (the rest defaults from the class). */}
      {showAdd && (
        <AssetForm
          form={form}
          set={set}
          setForm={setForm}
          setTicker={setTicker}
          setClass={setClass}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          setShowAdd={setShowAdd}
          setEditingId={setEditingId}
          pending={pending}
          editingId={editingId}
          submitAdd={submitAdd}
        />
      )}

      {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
    </div>
  );
}
