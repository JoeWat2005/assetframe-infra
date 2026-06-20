"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertEngineAsset, deleteEngineAsset, setAssetEnabled, setRequireApproval } from "./actions";
import type { EngineAsset } from "@/lib/engine-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Mirrors actions.ts / scripts/config_loader.py. The engine re-validates, so these are for the UI.
const ASSET_CLASSES = ["crypto", "equity", "fx", "futures", "index", "commodity"];
const SESSION_PROFILES = ["crypto_24_7", "fx_spot", "us_equity_rth", "cme_futures"];
const CADENCES = ["daily", "weekday", "trading_day", "weekday_or_market_open"];
const FORECAST_WINDOWS = ["rolling_24h", "next_liquid_session", "next_regular_session", "next_session"];
const TIMEZONES = [
  "UTC", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Australia/Sydney",
];

type Form = {
  id: string; name: string; instrument: string; ticker: string; yahoo: string;
  assetClass: string; sessionProfile: string; cadence: string; timezone: string;
  rollUtc: number; related: string; forecastWindow: string; publishPolicy: string; enabled: boolean;
};
const BLANK: Form = {
  id: "", name: "", instrument: "", ticker: "", yahoo: "", assetClass: "crypto",
  sessionProfile: "crypto_24_7", cadence: "daily", timezone: "UTC", rollUtc: 22, related: "",
  forecastWindow: "rolling_24h", publishPolicy: "approval_required", enabled: true,
};

type Result = { ok: boolean; message: string };

function Dropdown({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AssetManager({ assets, editingAsset }: { assets: EngineAsset[]; editingAsset?: Form }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Form>(editingAsset ?? BLANK);

  const requireApproval = assets.some((a) => a.publishPolicy === "approval_required");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

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
      if (r.ok) { setForm(BLANK); setShowAdd(false); }
      return r;
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Global approval toggle + add */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">New reports:</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${requireApproval ? "bg-[#fff7e6] text-[#9a6700]" : "bg-[#dafbe1] text-[#1a7f37]"}`}>
          {requireApproval ? "Need approval" : "Auto-publish"}
        </span>
        <Button
          size="sm" variant="outline" disabled={pending}
          onClick={() => run(() => setRequireApproval(!requireApproval),
            requireApproval ? "Auto-publish every new report (skip your approval)?" : "Require your approval before any new report goes live?")}
          title="Toggle whether generated reports go live immediately or wait for your approval (sets every asset's publish policy)."
        >
          {requireApproval ? "Switch to auto-publish" : "Require approval"}
        </Button>
        <Button size="sm" className="ml-auto" disabled={pending} onClick={() => { setForm(BLANK); setShowAdd((s) => !s); }}>
          {showAdd ? "Close" : "+ Add asset"}
        </Button>
      </div>

      {/* Universe table */}
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assets yet — add one below. (If this is unexpected, the engine-assets migration may not be applied.)</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-tile text-navy">
              <tr>
                <th className="p-2.5 text-left">Ticker</th>
                <th className="p-2.5 text-left">Instrument</th>
                <th className="p-2.5 text-left">Class</th>
                <th className="p-2.5 text-left">Cadence</th>
                <th className="p-2.5 text-left">Publish</th>
                <th className="p-2.5 text-left">In daily run</th>
                <th className="p-2.5 text-right">Remove</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="p-2.5 font-semibold text-navy">{a.ticker}</td>
                  <td className="p-2.5 text-muted-foreground">{a.name}</td>
                  <td className="p-2.5">{a.assetClass}</td>
                  <td className="p-2.5 text-muted-foreground">{a.cadence}</td>
                  <td className="p-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.publishPolicy === "auto" ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#fff7e6] text-[#9a6700]"}`}>
                      {a.publishPolicy === "auto" ? "auto" : "approval"}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => setAssetEnabled(a.id, !a.enabled))}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition disabled:opacity-50 ${a.enabled ? "bg-[#dafbe1] text-[#1a7f37] hover:bg-[#b7f0c6]" : "bg-tile text-muted-foreground hover:bg-line"}`}
                      title={a.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                    >
                      {a.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => deleteEngineAsset(a.id), `Remove ${a.ticker} from the universe?`)}
                      className="rounded-full bg-[#ffebe9] px-2.5 py-0.5 text-[11px] font-bold text-[#cf222e] transition hover:bg-[#ffd7d5] disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit form */}
      {showAdd && (
        <div className="rounded-xl border border-line bg-tile/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">id (lowercase)</label><Input className="h-9" value={form.id} onChange={(e) => set("id", e.target.value)} placeholder="btc" /></div>
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">ticker</label><Input className="h-9" value={form.ticker} onChange={(e) => set("ticker", e.target.value)} placeholder="BTC" /></div>
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Yahoo symbol (price feed)</label><Input className="h-9" value={form.yahoo} onChange={(e) => set("yahoo", e.target.value)} placeholder="BTC-USD" /></div>
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">name</label><Input className="h-9" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bitcoin" /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">instrument (full name)</label><Input className="h-9" value={form.instrument} onChange={(e) => set("instrument", e.target.value)} placeholder="Bitcoin / USD (aggregate spot)" /></div>
            <Dropdown label="asset class" value={form.assetClass} onChange={(v) => set("assetClass", v)} options={ASSET_CLASSES} />
            <Dropdown label="session profile" value={form.sessionProfile} onChange={(v) => set("sessionProfile", v)} options={SESSION_PROFILES} />
            <Dropdown label="cadence" value={form.cadence} onChange={(v) => set("cadence", v)} options={CADENCES} />
            <Dropdown label="timezone" value={form.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
            <Dropdown label="forecast window" value={form.forecastWindow} onChange={(v) => set("forecastWindow", v)} options={FORECAST_WINDOWS} />
            <Dropdown label="publish policy" value={form.publishPolicy} onChange={(v) => set("publishPolicy", v)} options={["approval_required", "auto"]} />
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">roll_utc (0–23)</label><Input className="h-9" type="number" value={form.rollUtc} onChange={(e) => set("rollUtc", Number(e.target.value))} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">related (comma list, optional)</label><Input className="h-9" value={form.related} onChange={(e) => set("related", e.target.value)} placeholder="ETH-USD" /></div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" disabled={pending} onClick={submitAdd}>{pending ? "Saving…" : "Save asset"}</Button>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" className="size-4 accent-navy" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> enabled
            </label>
          </div>
        </div>
      )}

      {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
    </div>
  );
}
