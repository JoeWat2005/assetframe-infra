"use client";
import { type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dropdown, Section } from "@/components/AssetFormFields";
import {
  ASSET_CLASSES, CADENCES, FORECAST_WINDOWS, REPORT_TIERS, HORIZON_LABELS, TIMEZONES,
  SESSION_PROFILES, CHART_INTERVALS, BLANK, type Form,
} from "@/lib/asset-constants";

export function AssetForm({
  form, set, setForm, setTicker, setClass, advancedOpen, setAdvancedOpen,
  setShowAdd, setEditingId, pending, editingId, submitAdd,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  setForm: Dispatch<SetStateAction<Form>>;
  setTicker: (v: string) => void;
  setClass: (v: string) => void;
  advancedOpen: boolean;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setShowAdd: Dispatch<SetStateAction<boolean>>;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  pending: boolean;
  editingId: string | null;
  submitAdd: () => void;
}) {
  return (
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
  );
}
