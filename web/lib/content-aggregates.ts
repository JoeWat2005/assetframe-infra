import type {
  OpenCall, TrackRecord, InstrumentPerf, AssetClassPerf, PredTypePerf,
  RegimePerf, TimelinePoint, CalibrationBin, ComponentOutcome,
} from "@/lib/content-types";
import type { Row } from "@/lib/content-helpers";

// Longest and current run of scored calls that came out net-positive (more hits than misses),
// in window order. Powers the homepage streak. No-trigger predictions are excluded — they're
// neither hit nor miss — so the win is measured against GRADED outcomes only (mirrors how the
// hit rate excludes No-trigger), NOT against `n`, which counts every registered prediction.
export function streaks(calls: OpenCall[]): { longestStreak: number; currentStreak: number } {
  const done = calls
    .filter((c) => c.scored)
    .sort((a, b) => a.windowEnd.localeCompare(b.windowEnd));
  let longest = 0, run = 0;
  for (const c of done) {
    const misses = (c.predictions || []).filter((p) => (p.verdict || "").trim().toUpperCase() === "N").length;
    const won = c.hits > misses;
    if (won) { run += 1; longest = Math.max(longest, run); }
    else run = 0;
  }
  return { longestStreak: longest, currentStreak: run };
}

export function computeCalibration(rows: Row[]): TrackRecord["calibration"] {
  if (rows.length < 10) return null;
  const buckets: Record<string, number[]> = { "<=60": [], "61-75": [], ">75": [] };
  for (const r of rows) {
    // Skip empty strings explicitly — Number("") is 0, which would pollute the <=60 bucket
    // (the Python/JSON path skips these, so this keeps both calibrations identical).
    if (r.confidence === "" || r.hit_rate === "" || r.confidence == null || r.hit_rate == null) continue;
    const c = Number(r.confidence), hr = Number(r.hit_rate);
    if (Number.isNaN(c) || Number.isNaN(hr)) continue;
    (c <= 60 ? buckets["<=60"] : c <= 75 ? buckets["61-75"] : buckets[">75"]).push(hr);
  }
  const out: Record<string, { hitRate: number | null; n: number }> = {};
  for (const [k, v] of Object.entries(buckets)) {
    out[k] = { hitRate: v.length ? Math.round((10 * v.reduce((a, b) => a + b, 0)) / v.length) / 10 : null, n: v.length };
  }
  return out;
}

// ---- Derived analytics computed in TS, mirroring export_content.py `_build_aggregates`,
// so the DB path produces the same shapes as the JSON fallback. `rows` are scored rows with
// numeric-ish hits/misses/confidence; taxonomy (assetClass/predType/regime) is optional per
// row (filled by a best-effort editions join on the DB path) and missing keys just yield
// empty groupings — never throws.
type ScoredLike = {
  reportId?: string; instrument?: string; confidence?: unknown; hits?: unknown;
  misses?: unknown; windowEnd?: string; ticker?: string;
  assetClass?: string; predType?: string; regime?: string;
};
const round1 = (x: number) => Math.round(x * 10) / 10;
const numOr = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
function rate(hits: number, misses: number): number | null {
  const g = hits + misses;
  return g ? round1((100 * hits) / g) : null;
}
const NEG = -1; // sort sentinel for null hitRate (pushes to the bottom)

function groupPerf<T extends string>(
  rows: ScoredLike[], keyOf: (r: ScoredLike) => string, label: T
): (Record<T, string> & { reportsScored: number; hits: number; misses: number; hitRate: number | null })[] {
  const g = new Map<string, { reportsScored: number; hits: number; misses: number }>();
  for (const r of rows) {
    const key = (keyOf(r) || "").trim();
    if (!key) continue;
    const e = g.get(key) || { reportsScored: 0, hits: 0, misses: 0 };
    e.reportsScored += 1; e.hits += numOr(r.hits); e.misses += numOr(r.misses);
    g.set(key, e);
  }
  const out = [...g.entries()].map(([key, e]) => ({
    [label]: key, reportsScored: e.reportsScored, hits: e.hits, misses: e.misses,
    hitRate: rate(e.hits, e.misses),
  })) as (Record<T, string> & { reportsScored: number; hits: number; misses: number; hitRate: number | null })[];
  out.sort((a, b) =>
    (b.hitRate ?? NEG) - (a.hitRate ?? NEG) || b.reportsScored - a.reportsScored ||
    (a as Record<T, string>)[label].localeCompare((b as Record<T, string>)[label]));
  return out;
}

export function buildAggregates(rows: ScoredLike[]): Required<Pick<TrackRecord,
  "byInstrument" | "byAssetClass" | "byPredictionType" | "byRegime" | "timeline" |
  "calibrationCurve" | "componentVsOutcome">> {
  const empty = {
    byInstrument: [], byAssetClass: [], byPredictionType: [], byRegime: [],
    timeline: [], calibrationCurve: [], componentVsOutcome: [],
  };
  if (!rows.length) return empty;

  // byInstrument carries ticker + normalized assetClass.
  const inst = new Map<string, { ticker: string; assetClass: string; reportsScored: number; hits: number; misses: number }>();
  for (const r of rows) {
    const name = (r.instrument || "").trim();
    if (!name) continue;
    const e = inst.get(name) || { ticker: "", assetClass: "", reportsScored: 0, hits: 0, misses: 0 };
    e.reportsScored += 1; e.hits += numOr(r.hits); e.misses += numOr(r.misses);
    if (!e.ticker && r.ticker) e.ticker = r.ticker;
    if (!e.assetClass && r.assetClass) e.assetClass = r.assetClass;
    inst.set(name, e);
  }
  const byInstrument: InstrumentPerf[] = [...inst.entries()].map(([instrument, e]) => ({
    instrument, ticker: e.ticker, assetClass: e.assetClass, reportsScored: e.reportsScored,
    hits: e.hits, misses: e.misses, hitRate: rate(e.hits, e.misses),
  }));
  byInstrument.sort((a, b) =>
    (b.hitRate ?? NEG) - (a.hitRate ?? NEG) || b.reportsScored - a.reportsScored ||
    a.instrument.localeCompare(b.instrument));

  const byAssetClass = groupPerf(rows, (r) => r.assetClass || "", "assetClass") as AssetClassPerf[];
  const byPredictionType = groupPerf(rows, (r) => r.predType || "", "predType") as PredTypePerf[];
  const byRegime = groupPerf(rows, (r) => r.regime || "", "regime") as RegimePerf[];

  // timeline: chronological by windowEnd, cumulative + per-report hit rate.
  const ordered = [...rows].sort((a, b) =>
    (a.windowEnd || "").localeCompare(b.windowEnd || "") ||
    (a.reportId || "").localeCompare(b.reportId || ""));
  let cumH = 0, cumM = 0;
  const timeline: TimelinePoint[] = ordered.map((r) => {
    const h = numOr(r.hits), m = numOr(r.misses);
    cumH += h; cumM += m;
    return {
      reportId: r.reportId || "", instrument: r.instrument || "", windowEnd: r.windowEnd || "",
      perReportHitRate: rate(h, m), cumulativeHitRate: rate(cumH, cumM),
    };
  });

  // calibrationCurve: 10-point confidence bins, gated to overall n>=10 (mirrors Python).
  const calibrationCurve: CalibrationBin[] = [];
  if (rows.length >= 10) {
    const bins = new Map<number, { reports: number; hits: number; misses: number }>();
    for (const r of rows) {
      const c = Number(r.confidence);
      if (!Number.isFinite(c)) continue;
      const lo = Math.max(0, Math.min(90, Math.floor(c / 10) * 10));
      const b = bins.get(lo) || { reports: 0, hits: 0, misses: 0 };
      b.reports += 1; b.hits += numOr(r.hits); b.misses += numOr(r.misses);
      bins.set(lo, b);
    }
    for (const lo of [...bins.keys()].sort((a, b) => a - b)) {
      const b = bins.get(lo)!;
      calibrationCurve.push({
        bucket: `${lo}-${lo + 9}`, confLo: lo, confHi: lo + 9,
        reports: b.reports, hits: b.hits, misses: b.misses, hitRate: rate(b.hits, b.misses),
      });
    }
  }

  // componentVsOutcome: realised hit rate vs mean stated confidence, by display band.
  const band = (score: unknown): string | null => {
    const sNum = Number(score);
    if (!Number.isFinite(sNum)) return null;
    if (sNum < 50) return "Low";
    if (sNum < 65) return "Moderate";
    if (sNum < 80) return "Elevated";
    return "High";
  };
  const cb = new Map<string, { reports: number; hits: number; misses: number; confSum: number; confN: number }>();
  for (const r of rows) {
    const bnd = band(r.confidence);
    if (!bnd) continue;
    const e = cb.get(bnd) || { reports: 0, hits: 0, misses: 0, confSum: 0, confN: 0 };
    e.reports += 1; e.hits += numOr(r.hits); e.misses += numOr(r.misses);
    const c = Number(r.confidence);
    if (Number.isFinite(c)) { e.confSum += c; e.confN += 1; }
    cb.set(bnd, e);
  }
  const componentVsOutcome: ComponentOutcome[] = ["Low", "Moderate", "Elevated", "High"]
    .filter((b) => cb.has(b))
    .map((b) => {
      const e = cb.get(b)!;
      return { band: b, reports: e.reports, avgConfidence: e.confN ? round1(e.confSum / e.confN) : null, hitRate: rate(e.hits, e.misses) };
    });

  return { byInstrument, byAssetClass, byPredictionType, byRegime, timeline, calibrationCurve, componentVsOutcome };
}
