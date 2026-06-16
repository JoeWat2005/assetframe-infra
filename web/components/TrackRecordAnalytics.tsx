"use client";
import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, ReferenceLine,
} from "recharts";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type {
  InstrumentPerf, AssetClassPerf, PredTypePerf, RegimePerf, TimelinePoint, CalibrationBin,
  ComponentOutcome,
} from "@/lib/content";

// Pro-only deeper analytics for the track-record page. Mirrors the admin Recharts setup
// (ChartContainer + ChartTooltipContent). Every section guards its own data so an empty
// ledger renders nothing (the page hides the whole block in that case).

const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function PerfTable({ rows }: { rows: InstrumentPerf[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full overflow-hidden rounded-xl border border-line bg-white text-sm">
        <thead className="bg-tile text-navy">
          <tr>
            <th className="p-3 text-left">Instrument</th>
            <th className="p-3 text-left">Asset class</th>
            <th className="p-3 text-right">Scored</th>
            <th className="p-3 text-right">Hits</th>
            <th className="p-3 text-right">Misses</th>
            <th className="p-3 text-right">Hit rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const good = (r.hitRate ?? 0) >= 50;
            return (
              <tr key={r.instrument} className="border-t border-line">
                <td className="p-3"><b>{r.instrument}</b>{r.ticker ? <span className="ml-1 text-xs text-muted-foreground">{r.ticker}</span> : null}</td>
                <td className="p-3">{r.assetClass ? titleCase(r.assetClass) : "—"}</td>
                <td className="p-3 text-right tabular-nums">{r.reportsScored}</td>
                <td className="p-3 text-right tabular-nums">{r.hits}</td>
                <td className="p-3 text-right tabular-nums">{r.misses}</td>
                <td className="p-3 text-right">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.hitRate == null ? "bg-tile text-muted-foreground" : good ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#ffebe9] text-[#cf222e]"}`}>
                    {pct(r.hitRate)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Horizontal hit-rate bars for a flat grouping (asset class / prediction type / regime).
function HitRateBars({
  data, labelKey,
}: { data: { label: string; hitRate: number | null; reportsScored: number }[]; labelKey: string }) {
  const config = { hitRate: { label: "Hit rate", color: "#0b2545" } } satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, hitRateNum: d.hitRate ?? 0 }));
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} unit="%" />
        <YAxis
          type="category" dataKey="label" tickLine={false} axisLine={false} width={110}
          tickFormatter={(v: string) => titleCase(v)}
        />
        <ChartTooltip
          content={<ChartTooltipContent nameKey={labelKey} labelFormatter={(v) => titleCase(String(v))} />}
        />
        <Bar dataKey="hitRateNum" name="Hit rate" fill="var(--color-hitRate)" radius={4} unit="%" />
      </BarChart>
    </ChartContainer>
  );
}

function CalibrationCurve({ data }: { data: CalibrationBin[] }) {
  const config = { hitRate: { label: "Realised hit rate", color: "#1a7f37" } } satisfies ChartConfig;
  // Plot realised hit rate at each confidence-bin midpoint; the dashed diagonal is the
  // perfectly-calibrated reference (stated == realised).
  const rows = data
    .filter((d) => d.hitRate != null)
    .map((d) => ({ mid: (d.confLo + d.confHi + 1) / 2, hitRate: d.hitRate as number, bucket: d.bucket, reports: d.reports }));
  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <LineChart data={rows} margin={{ left: -8, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number" dataKey="mid" domain={[0, 100]} tickLine={false} axisLine={false}
          tickMargin={8} unit="%" name="Stated confidence"
        />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} unit="%" />
        <ReferenceLine
          segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
          stroke="#9fb3c8" strokeDasharray="4 4" ifOverflow="extendDomain"
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_l, p) => {
            const d = p?.[0]?.payload as { bucket?: string; reports?: number } | undefined;
            return d?.bucket ? `Confidence ${d.bucket} · ${d.reports} report${d.reports === 1 ? "" : "s"}` : "";
          }} />}
        />
        <Line dataKey="hitRate" name="Realised hit rate" type="monotone" stroke="var(--color-hitRate)" strokeWidth={2} dot={{ r: 3 }} unit="%" />
      </LineChart>
    </ChartContainer>
  );
}

function HitRateOverTime({ data }: { data: TimelinePoint[] }) {
  const config = {
    cumulativeHitRate: { label: "Cumulative", color: "#0b2545" },
    perReportHitRate: { label: "Per report", color: "#9a6700" },
  } satisfies ChartConfig;
  const rows = data.map((d) => ({
    date: (d.windowEnd || "").slice(0, 10),
    cumulativeHitRate: d.cumulativeHitRate, perReportHitRate: d.perReportHitRate,
    instrument: d.instrument,
  }));
  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <LineChart data={rows} margin={{ left: -8, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28}
          tickFormatter={(v: string) => (typeof v === "string" ? v.slice(5) : v)}
        />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} unit="%" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="cumulativeHitRate" name="Cumulative" type="monotone" stroke="var(--color-cumulativeHitRate)" strokeWidth={2} dot={false} connectNulls unit="%" />
        <Line dataKey="perReportHitRate" name="Per report" type="monotone" stroke="var(--color-perReportHitRate)" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} connectNulls unit="%" />
      </LineChart>
    </ChartContainer>
  );
}

export default function TrackRecordAnalytics({
  byInstrument = [], byAssetClass = [], byPredictionType = [], byRegime = [],
  timeline = [], calibrationCurve = [], componentVsOutcome = [],
}: {
  byInstrument?: InstrumentPerf[]; byAssetClass?: AssetClassPerf[];
  byPredictionType?: PredTypePerf[]; byRegime?: RegimePerf[];
  timeline?: TimelinePoint[]; calibrationCurve?: CalibrationBin[];
  componentVsOutcome?: ComponentOutcome[];
}) {
  const hasAny =
    byInstrument.length || byAssetClass.length || byPredictionType.length ||
    byRegime.length || timeline.length || calibrationCurve.length || componentVsOutcome.length;
  if (!hasAny) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-xl font-bold text-navy">Performance analytics</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Every figure derives from the scored ledger — predictions registered before each window,
        then graded against the tape. Breakdowns appear as the sample grows.
      </p>

      {timeline.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Hit rate over time</CardTitle>
            <CardDescription>Cumulative accuracy (solid) and each report&rsquo;s own hit rate (dashed), in window order.</CardDescription>
          </CardHeader>
          <CardContent><HitRateOverTime data={timeline} /></CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {byAssetClass.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By asset class</CardTitle>
              <CardDescription>Realised hit rate per asset class.</CardDescription>
            </CardHeader>
            <CardContent>
              <HitRateBars
                labelKey="assetClass"
                data={byAssetClass.map((d) => ({ label: d.assetClass, hitRate: d.hitRate, reportsScored: d.reportsScored }))}
              />
            </CardContent>
          </Card>
        )}

        {byPredictionType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By prediction type</CardTitle>
              <CardDescription>Hit rate by the call&rsquo;s strategic archetype.</CardDescription>
            </CardHeader>
            <CardContent>
              <HitRateBars
                labelKey="predType"
                data={byPredictionType.map((d) => ({ label: d.predType, hitRate: d.hitRate, reportsScored: d.reportsScored }))}
              />
            </CardContent>
          </Card>
        )}

        {byRegime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By market regime</CardTitle>
              <CardDescription>Hit rate by the regime tagged at registration.</CardDescription>
            </CardHeader>
            <CardContent>
              <HitRateBars
                labelKey="regime"
                data={byRegime.map((d) => ({ label: d.regime, hitRate: d.hitRate, reportsScored: d.reportsScored }))}
              />
            </CardContent>
          </Card>
        )}

        {calibrationCurve.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calibration curve</CardTitle>
              <CardDescription>Realised hit rate vs stated confidence (dashed = perfectly calibrated). Shown once 10+ reports are scored.</CardDescription>
            </CardHeader>
            <CardContent><CalibrationCurve data={calibrationCurve} /></CardContent>
          </Card>
        )}
      </div>

      {componentVsOutcome.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-white text-sm">
            <thead className="bg-tile text-navy">
              <tr>
                <th className="p-3 text-left">Confidence band</th>
                <th className="p-3 text-right">Reports</th>
                <th className="p-3 text-right">Avg stated</th>
                <th className="p-3 text-right">Realised hit rate</th>
              </tr>
            </thead>
            <tbody>
              {componentVsOutcome.map((r) => (
                <tr key={r.band} className="border-t border-line">
                  <td className="p-3">{r.band}</td>
                  <td className="p-3 text-right tabular-nums">{r.reports}</td>
                  <td className="p-3 text-right tabular-nums">{r.avgConfidence == null ? "—" : `${r.avgConfidence}%`}</td>
                  <td className="p-3 text-right tabular-nums">{pct(r.hitRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Stated confidence vs the outcome that actually followed — the realised hit rate should rise with the band.
          </p>
        </div>
      )}

      {byInstrument.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-bold text-navy">By instrument</h3>
          <PerfTable rows={byInstrument} />
        </div>
      )}
    </section>
  );
}
