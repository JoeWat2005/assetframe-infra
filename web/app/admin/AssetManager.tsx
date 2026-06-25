"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { upsertEngineAsset, deleteEngineAsset, setAssetEnabled, setRequireApproval, sendEngineCommand } from "./actions";
import type { EngineAsset } from "@/lib/engine-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Mirrors actions.ts / scripts/config_loader.py. The engine re-validates, so these are for the UI.
const ASSET_CLASSES = ["crypto", "equity", "fx", "futures", "index", "commodity"];
const SESSION_PROFILES = ["crypto_24_7", "fx_spot", "us_equity_rth", "cme_futures"];
const CADENCES = ["daily", "weekday", "trading_day", "weekday_or_market_open", "weekly", "monthly"];
const FORECAST_WINDOWS = ["rolling_24h", "next_liquid_session", "next_regular_session", "next_session", "next_week", "next_5_sessions"];
const REPORT_TIERS = ["official", "watchlist", "staged", "backtest"];
// Human labels for the forecast-window enums shown on the horizon chips (enum kept in the tooltip).
const HORIZON_LABELS: Record<string, string> = {
  rolling_24h: "Next 24 hours", next_liquid_session: "Next liquid session",
  next_regular_session: "Next regular session", next_session: "Next session",
  next_week: "Next week", next_5_sessions: "Next 5 sessions",
};
const TIMEZONES = [
  "UTC", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Australia/Sydney",
];
// Sensible engine defaults per asset class. When you pick a class on a NEW asset these prefill the
// Advanced (session/timing) fields, so a non-expert never has to touch session/window math. They
// stay fully editable in Advanced, and editing an existing asset never overwrites its real settings.
const CLASS_DEFAULTS: Record<string, { sessionProfile: string; cadence: string; timezone: string; forecastWindow: string; rollUtc: number }> = {
  crypto:    { sessionProfile: "crypto_24_7",   cadence: "daily",                  timezone: "UTC",              forecastWindow: "rolling_24h",          rollUtc: 22 },
  equity:    { sessionProfile: "us_equity_rth", cadence: "trading_day",            timezone: "America/New_York", forecastWindow: "next_regular_session", rollUtc: 0 },
  index:     { sessionProfile: "us_equity_rth", cadence: "trading_day",            timezone: "America/New_York", forecastWindow: "next_regular_session", rollUtc: 0 },
  fx:        { sessionProfile: "fx_spot",       cadence: "daily",                  timezone: "UTC",              forecastWindow: "next_liquid_session",  rollUtc: 22 },
  commodity: { sessionProfile: "fx_spot",       cadence: "weekday_or_market_open", timezone: "UTC",              forecastWindow: "next_liquid_session",  rollUtc: 22 },
  futures:   { sessionProfile: "cme_futures",   cadence: "weekday_or_market_open", timezone: "America/Chicago",  forecastWindow: "next_session",         rollUtc: 22 },
};

type Form = {
  id: string; name: string; instrument: string; ticker: string; yahoo: string; eodhd: string;
  assetClass: string; sessionProfile: string; cadence: string; timezone: string;
  rollUtc: number; related: string; forecastWindow: string; publishPolicy: string;
  reportTier: string; enabled: boolean;
  cadenceDay: string; timeframes: string[]; chartIntervals: string[];
  includeFundamentals: boolean; includeNews: boolean;
  fundamentalsSource: string;
};
const BLANK: Form = {
  id: "", name: "", instrument: "", ticker: "", yahoo: "", eodhd: "", assetClass: "crypto",
  sessionProfile: "crypto_24_7", cadence: "daily", timezone: "UTC", rollUtc: 22, related: "",
  forecastWindow: "rolling_24h", publishPolicy: "approval_required", reportTier: "official",
  enabled: true,
  cadenceDay: "", timeframes: [], chartIntervals: [], includeFundamentals: false, includeNews: true,
  fundamentalsSource: "auto",
};
// The candle intervals an asset can be analysed from (mirror of scripts/config_loader.CHART_INTERVALS).
const CHART_INTERVALS = ["60m", "2h", "4h", "8h", "1d", "1week", "1month"] as const;

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

// Small grey section heading inside the add/edit form, so the fields read as labelled groups.
function Section({ children }: { children: ReactNode }) {
  return <div className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-navy/70">{children}</div>;
}

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

      {/* Universe table */}
      {assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-tile/40 px-4 py-6 text-center text-sm text-muted-foreground">No assets yet — click <b>+ Add asset</b> to add your first instrument.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-tile text-navy">
              <tr>
                <th className="p-2.5 text-left">Ticker</th>
                <th className="p-2.5 text-left">Instrument</th>
                <th className="p-2.5 text-left">Class</th>
                <th className="p-2.5 text-left">Cadence</th>
                <th className="p-2.5 text-left">Scheduled</th>
                <th className="p-2.5 text-left">Publish</th>
                <th className="p-2.5 text-left">In daily run</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="p-2.5 font-semibold text-navy">{a.ticker}</td>
                  <td className="p-2.5 text-muted-foreground">{a.name}</td>
                  <td className="p-2.5">{a.assetClass}</td>
                  <td className="p-2.5 text-muted-foreground">{a.cadence}</td>
                  <td className="p-2.5" title={a.dueReason || undefined}>
                    {!a.enabled ? (
                      <span className="text-[11px] text-muted-foreground">off</span>
                    ) : a.due == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : a.due ? (
                      <span className="rounded-full bg-[#dafbe1] px-2 py-0.5 text-[11px] font-bold text-[#1a7f37]">Due now</span>
                    ) : (
                      <span className="rounded-full bg-tile px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Not due</span>
                    )}
                  </td>
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
                      onClick={() => startEdit(a)}
                      className="mr-1.5 rounded-full bg-tile px-2.5 py-0.5 text-[11px] font-bold text-navy transition hover:bg-line disabled:opacity-50"
                      title="Edit this asset's settings"
                    >
                      Edit
                    </button>
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

      {/* Add / edit form — grouped Basics / Schedule / Horizons / Content / Advanced so it reads
          top-to-bottom and a non-expert can fill only the Basics (the rest defaults from the class). */}
      {showAdd && (
        <div className="rounded-xl border border-line bg-tile/30 p-4">
          <div className="text-sm font-bold text-navy">{editingId ? `Edit ${form.ticker || editingId}` : "Add a new asset"}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {editingId
              ? "Change this instrument's settings, then Save changes."
              : "Fill in the Basics — session and timing defaults for the asset class are filled in for you. Open Advanced only if you need to change them."}
          </p>

          <Section>Basics</Section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Ticker</label><Input className="h-9" value={form.ticker} onChange={(e) => setTicker(e.target.value)} placeholder="BTC" /></div>
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Display name</label><Input className="h-9" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bitcoin" /></div>
            <Dropdown label="Asset class" value={form.assetClass} onChange={setClass} options={ASSET_CLASSES} />
            <div className="sm:col-span-2"><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Full instrument name</label><Input className="h-9" value={form.instrument} onChange={(e) => set("instrument", e.target.value)} placeholder="Bitcoin / USD (aggregate spot)" /></div>
            <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Price symbol (Yahoo)</label><Input className="h-9" value={form.yahoo} onChange={(e) => set("yahoo", e.target.value)} placeholder="BTC-USD" /></div>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            The <b>price symbol</b> is how the engine pulls candles — e.g. <span className="font-mono">BTC-USD</span>, <span className="font-mono">AAPL</span>, <span className="font-mono">GBPUSD=X</span>, <span className="font-mono">GC=F</span> (gold).
            {!editingId && <> Saved under id <span className="font-mono">{form.id || "—"}</span> (from the ticker).</>}
          </p>

          <Section>Schedule &amp; publishing</Section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Dropdown label="How often (cadence)" value={form.cadence} onChange={(v) => set("cadence", v)} options={CADENCES} />
            {form.cadence === "weekly" && (
              <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Day of week (mon–sun)</label><Input className="h-9" value={form.cadenceDay} onChange={(e) => set("cadenceDay", e.target.value)} placeholder="fri" /></div>
            )}
            <Dropdown label="Publishing" value={form.publishPolicy} onChange={(v) => set("publishPolicy", v)} options={["approval_required", "auto"]} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            <b>Cadence</b> = how often a report generates. <b>Publishing</b>: <span className="font-mono">auto</span> goes live immediately; <span className="font-mono">approval_required</span> holds each one for you in step 3.
          </p>

          <Section>Forecast horizons <span className="font-normal normal-case text-muted-foreground">(optional — most assets need none)</span></Section>
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            Your <b>cadence</b> above already sets the default scoring window (daily → day-end, weekly → week-end, monthly → month-end). Add a chip only for an <b>extra</b> prediction track at another horizon — the first you pick (★) becomes the published headline. Leave empty for a single call over the cadence window.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {FORECAST_WINDOWS.map((w) => {
              const i = form.timeframes.indexOf(w);
              const on = i >= 0;
              return (
                <button
                  key={w} type="button"
                  onClick={() => set("timeframes", on ? form.timeframes.filter((t) => t !== w) : [...form.timeframes, w])}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${on ? "bg-navy text-white" : "bg-tile text-muted-foreground ring-1 ring-inset ring-line hover:bg-line"}`}
                  title={on ? "Selected — click to remove" : "Click to add this horizon"}
                >
                  {on ? `${i === 0 ? "★ " : ""}${HORIZON_LABELS[w] ?? w}` : `+ ${HORIZON_LABELS[w] ?? w}`}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {form.timeframes.length === 0
              ? "No extra horizons — one call scored over the cadence window."
              : `${form.timeframes.length} horizon track${form.timeframes.length > 1 ? "s" : ""} · ★ published headline = ${HORIZON_LABELS[form.timeframes[0]] ?? form.timeframes[0]}.`}
          </p>

          <Section>Chart intervals</Section>
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            The candle intervals the engine <b>analyses</b> to form the view (distinct from the forecast
            horizons above). <b>Click a chip to add it.</b> 60m + 1d are always included. Daily reports
            usually want 60m/1d; weekly add 1week; monthly add 1month.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {CHART_INTERVALS.map((iv) => {
              const canonical = iv === "60m" || iv === "1d";
              const on = canonical || form.chartIntervals.includes(iv);
              return (
                <button
                  key={iv} type="button"
                  disabled={canonical}
                  onClick={() => set("chartIntervals", on ? form.chartIntervals.filter((t) => t !== iv) : [...form.chartIntervals, iv])}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${on ? "bg-navy text-white" : "bg-tile text-muted-foreground ring-1 ring-inset ring-line hover:bg-line"} ${canonical ? "opacity-70" : ""}`}
                  title={canonical ? "Always analysed" : on ? "Selected — click to remove" : "Click to add this interval"}
                >
                  {on ? `${canonical ? "● " : ""}${iv}` : `+ ${iv}`}
                </button>
              );
            })}
          </div>

          <Section>Report content</Section>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Include this instrument in the daily 05:00 run.">
              <input type="checkbox" className="size-4 accent-navy" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Enabled (in daily run)
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Add P/E, margins and latest earnings to the Pro report. Equities only.">
              <input type="checkbox" className="size-4 accent-navy" checked={form.includeFundamentals} onChange={(e) => set("includeFundamentals", e.target.checked)} /> Fundamentals
            </label>
            {form.includeFundamentals && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                from
                <Select value={form.fundamentalsSource} onValueChange={(v) => set("fundamentalsSource", v)}>
                  <SelectTrigger className="h-8 w-[124px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>{["auto", "twelvedata", "none"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Research news / catalysts in the brief via web search. Off = technical-only.">
              <input type="checkbox" className="size-4 accent-navy" checked={form.includeNews} onChange={(e) => set("includeNews", e.target.checked)} /> News &amp; catalysts
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            <b>Fundamentals</b> (equities) adds valuation, margins &amp; earnings to Pro; <b>from</b> sets where they come from (<span className="font-mono">auto</span> follows the global feed, <span className="font-mono">twelvedata</span> forces it, <span className="font-mono">none</span> skips). <b>News</b> researches catalysts.
          </p>

          <button
            type="button" onClick={() => setAdvancedOpen((s) => !s)}
            className="mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-navy/70 hover:text-navy"
          >
            <span>{advancedOpen ? "▾" : "▸"}</span> Advanced — data feed &amp; session timing
          </button>
          {advancedOpen && (
            <>
              <p className="mb-2 mt-1 text-[11px] text-muted-foreground">Defaults come from the asset class above — only change these if you know you need to.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Dropdown label="session profile" value={form.sessionProfile} onChange={(v) => set("sessionProfile", v)} options={SESSION_PROFILES} />
                <Dropdown label="timezone" value={form.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
                <Dropdown label="report tier" value={form.reportTier} onChange={(v) => set("reportTier", v)} options={REPORT_TIERS} />
                <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">roll hour (UTC, 0–23)</label><Input className="h-9" type="number" value={form.rollUtc} onChange={(e) => set("rollUtc", Number(e.target.value))} /></div>
                <div><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">EODHD symbol (optional)</label><Input className="h-9" value={form.eodhd} onChange={(e) => set("eodhd", e.target.value)} placeholder="GBPUSD.FOREX" /></div>
                <div className="sm:col-span-2"><label className="mb-1 block text-[11px] font-semibold text-muted-foreground">related tickers (comma list, optional)</label><Input className="h-9" value={form.related} onChange={(e) => set("related", e.target.value)} placeholder="ETH-USD" /></div>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={pending} onClick={submitAdd}>{pending ? "Saving…" : editingId ? "Save changes" : "Save asset"}</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => { setShowAdd(false); setEditingId(null); setForm(BLANK); setAdvancedOpen(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
    </div>
  );
}
