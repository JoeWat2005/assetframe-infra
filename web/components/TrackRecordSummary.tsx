"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AssetClassPerf, CadencePerf, InstrumentPerf } from "@/lib/content";

// FREE-tier micro-dashboard: per-asset-class, per-cadence and per-instrument hit rates with a small
// view toggle + summary badges + a bar chart. Visible to everyone (the proof), above the Pro-gated
// deep analytics. All figures come from the scored ledger (hits/(hits+misses)).

const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type Row = { label: string; hitRate: number | null; reportsScored: number };

function Bars({ data }: { data: Row[] }) {
  const config = { hitRate: { label: "Hit rate", color: "#0b2545" } } satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, hitRateNum: d.hitRate ?? 0 }));
  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} unit="%" />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={120}
               tickFormatter={(v: string) => titleCase(v)} />
        <ChartTooltip content={<ChartTooltipContent nameKey="hitRate" labelFormatter={(v) => titleCase(String(v))} />} />
        <Bar dataKey="hitRateNum" name="Hit rate" fill="var(--color-hitRate)" radius={4} unit="%" />
      </BarChart>
    </ChartContainer>
  );
}

type View = "class" | "cadence" | "asset";
const VIEWS: { key: View; label: string }[] = [
  { key: "class", label: "By asset class" },
  { key: "cadence", label: "By cadence" },
  { key: "asset", label: "By instrument" },
];

export default function TrackRecordSummary({
  byAssetClass = [], byCadence = [], byInstrument = [], cumulativeHitRate = null, currentStreak = 0,
}: {
  byAssetClass?: AssetClassPerf[]; byCadence?: CadencePerf[]; byInstrument?: InstrumentPerf[];
  cumulativeHitRate?: number | null; currentStreak?: number;
}) {
  // pick the first view that actually has data so the toggle never opens empty
  const available = VIEWS.filter((v) =>
    (v.key === "class" && byAssetClass.length) ||
    (v.key === "cadence" && byCadence.length) ||
    (v.key === "asset" && byInstrument.length));
  const [view, setView] = useState<View>(available[0]?.key ?? "class");
  if (available.length === 0) return null;

  const rows: Row[] =
    view === "class"
      ? byAssetClass.map((d) => ({ label: d.assetClass, hitRate: d.hitRate, reportsScored: d.reportsScored }))
      : view === "cadence"
        ? byCadence.map((d) => ({ label: d.cadence, hitRate: d.hitRate, reportsScored: d.reportsScored }))
        : byInstrument.map((d) => ({ label: d.instrument, hitRate: d.hitRate, reportsScored: d.reportsScored }));

  // a couple of headline badges: best-performing slice of the current view (>=1 scored)
  const ranked = [...rows].filter((r) => r.hitRate != null && r.reportsScored > 0)
    .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0));
  const best = ranked[0];

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Performance at a glance</CardTitle>
          <CardDescription>Realised hit rate by asset class, cadence and instrument — the public proof.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {available.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                view === v.key ? "bg-navy text-white" : "bg-tile text-[#33415c] hover:bg-[#dde6f2]"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
            <b className="text-navy">{pct(cumulativeHitRate)}</b>{" "}
            <span className="text-muted-foreground">cumulative hit rate</span>
          </span>
          {currentStreak > 0 && (
            <span className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
              <b className="text-navy">{currentStreak}</b>{" "}
              <span className="text-muted-foreground">current streak</span>
            </span>
          )}
          {best && (
            <span className="rounded-lg border border-[#1a7f37]/30 bg-[#dafbe1] px-3 py-1.5 text-sm text-[#1a7f37]">
              Best: <b>{titleCase(best.label)}</b> {pct(best.hitRate)} over {best.reportsScored}
            </span>
          )}
        </div>
        <Bars data={rows} />
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {rows.map((r) => {
            const good = (r.hitRate ?? 0) >= 50;
            return (
              <div key={r.label} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
                <span className="truncate font-medium text-navy">{titleCase(r.label)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.reportsScored} scored</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    r.hitRate == null ? "bg-tile text-muted-foreground" : good ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#ffebe9] text-[#cf222e]"}`}>
                    {pct(r.hitRate)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
