import "server-only";
import fs from "node:fs";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { sql } from "./db";

export type Edition = {
  date: string; slug: string; instrument: string; ticker: string;
  assetClass: string; status: string; risk: string; bias: string;
  lastPrice: string; dataQuality: string | number; windowEnd: string;
  reportDate: string; catalystStatus: string;
  freeHtml: string; freePdf: string; preview: string; hasPro: boolean; hidden: boolean;
  confidence?: number | null; // research confidence (0–100), joined from the open call
};

export type SubCall = {
  id: string; type: string; text: string; manual: boolean; expect?: boolean | null;
  // Per-prediction outcome merged from the ledger's packed results ("Y"|"N"|"NT"|""),
  // and the edition-level prediction archetype. Optional so DB + JSON shapes both satisfy.
  verdict?: string; predType?: string;
};
export type OpenCall = {
  reportId: string; instrument: string; symbol: string; view: string;
  confidence: string | number; windowEnd: string; n: number; nManual: number;
  hits: number; scored: boolean; // tracker: hits/n, scored flips true after the engine reruns
  predictions: SubCall[];
};
export type ScoredRow = {
  instrument: string; view: string; confidence: string | number;
  results: string; hitRate: string | number; windowEnd: string;
  // Present in the JSON-fallback rows (written by export_content.py) and read by sync-db;
  // not selected on the DB path. Optional so both shapes satisfy the type.
  reportId?: string; hits?: string | number; misses?: string | number;
  // Normalized taxonomy fields (JSON-fallback + DB where columns exist).
  assetClass?: string; predType?: string;
};

// ---- Derived track-record analytics (Task T12). All additive; empty arrays when the
// ledger is empty, so consumers must tolerate [] / undefined and never assume presence.
export type InstrumentPerf = {
  instrument: string; ticker: string; assetClass: string;
  reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type AssetClassPerf = {
  assetClass: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type PredTypePerf = {
  predType: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type RegimePerf = {
  regime: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type TimelinePoint = {
  reportId: string; instrument: string; windowEnd: string;
  perReportHitRate: number | null; cumulativeHitRate: number | null;
};
export type CalibrationBin = {
  bucket: string; confLo: number; confHi: number;
  reports: number; hits: number; misses: number; hitRate: number | null;
};
export type ComponentOutcome = {
  band: string; reports: number; avgConfidence: number | null; hitRate: number | null;
};

export type TrackRecord = {
  stats: {
    reportsScored: number; openCalls: number; predictionsGraded: number; hitRate: number | null;
    longestStreak: number; currentStreak: number;
  };
  open: OpenCall[]; scored: ScoredRow[];
  calibration: Record<string, { hitRate: number | null; n: number }> | null;
  // Derived analytics — optional everywhere so older JSON / a DB without the columns degrades.
  byInstrument?: InstrumentPerf[];
  byAssetClass?: AssetClassPerf[];
  byPredictionType?: PredTypePerf[];
  byRegime?: RegimePerf[];
  timeline?: TimelinePoint[];
  calibrationCurve?: CalibrationBin[];
  componentVsOutcome?: ComponentOutcome[];
};

// Longest and current run of scored calls where a strict majority of the call's
// predictions came true (hits*2 > n), in window order. Powers the homepage streak.
function streaks(calls: OpenCall[]): { longestStreak: number; currentStreak: number } {
  const done = calls
    .filter((c) => c.scored)
    .sort((a, b) => a.windowEnd.localeCompare(b.windowEnd));
  let longest = 0, run = 0;
  for (const c of done) {
    const won = c.hits * 2 > (Number(c.n) || 0);
    if (won) { run += 1; longest = Math.max(longest, run); }
    else run = 0;
  }
  return { longestStreak: longest, currentStreak: run };
}

// ------------------------------------------------------------------ JSON fallback
const CONTENT = path.join(process.cwd(), "content");
function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONTENT, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------ row mappers
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

function rowToEdition(r: Row): Edition {
  const date = s(r.report_date).slice(0, 10);
  return {
    date, slug: s(r.slug), instrument: s(r.instrument), ticker: s(r.ticker),
    assetClass: s(r.asset_class), status: s(r.status), risk: s(r.risk), bias: s(r.bias),
    lastPrice: "", dataQuality: r.data_quality == null ? "" : Number(r.data_quality),
    windowEnd: s(r.window_end), reportDate: date, catalystStatus: s(r.catalyst_status),
    freeHtml: s(r.free_html_key), freePdf: s(r.free_pdf_key), preview: s(r.preview_key),
    hasPro: Boolean(r.has_pro), hidden: Boolean(r.hidden),
    confidence: r.confidence == null || r.confidence === "" ? null : Number(r.confidence),
  };
}

const EDITION_COLS = `e.id, e.report_date::text AS report_date, e.slug, e.instrument, e.ticker,
  e.asset_class, e.status, e.risk, e.bias, e.data_quality, e.window_end, e.catalyst_status, e.has_pro,
  e.free_html_key, e.free_pdf_key, e.preview_key, coalesce(e.hidden, false) AS hidden,
  oc.confidence AS confidence`;
// Confidence isn't on the editions table — join the open call by its derived report_id
// (edition id "2026-06-15/AAPL" -> "AF-20260615-AAPL"). LEFT JOIN so editions without a
// registered call still return.
const EDITION_FROM = `FROM editions e
  LEFT JOIN open_calls oc
    ON oc.report_id = 'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug`;

// ------------------------------------------------------------------ public API (DB-first)
// Wrapped in unstable_cache below so reloads serve from Next's Data Cache (no re-query).
async function _getCatalog(): Promise<Edition[]> {
  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT ${EDITION_COLS} ${EDITION_FROM} WHERE coalesce(e.hidden, false) = false ORDER BY e.report_date DESC, e.slug DESC`
      );
      return (rows as Row[]).map(rowToEdition);
    } catch {
      /* fall through to JSON */
    }
  }
  return readJson<Edition[]>("catalog.json", []);
}

// Admin view: ALL editions, including hidden ones (with the hidden flag). Uncached so the
// admin always sees the live state right after toggling.
export async function getAllEditions(): Promise<Edition[]> {
  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT ${EDITION_COLS} ${EDITION_FROM} ORDER BY e.report_date DESC, e.slug DESC`
      );
      return (rows as Row[]).map(rowToEdition);
    } catch {
      /* fall through */
    }
  }
  return readJson<Edition[]>("catalog.json", []);
}

// Admin view: ONLY hidden editions, most-recent first. These were generated behind the
// engine's approval gate (hidden=true) and are awaiting an admin to approve (un-hide) them.
// Uncached so the list updates the moment one is approved.
export async function getHiddenEditions(): Promise<Edition[]> {
  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT ${EDITION_COLS} ${EDITION_FROM} WHERE coalesce(e.hidden, false) = true ORDER BY e.report_date DESC, e.slug DESC`
      );
      return (rows as Row[]).map(rowToEdition);
    } catch {
      /* fall through */
    }
  }
  // JSON fallback can't represent hidden editions (the catalog excludes them), so an empty
  // list is the correct degraded behaviour.
  return readJson<Edition[]>("catalog.json", []).filter((e) => e.hidden);
}

export async function getEdition(date: string, slug: string): Promise<Edition | undefined> {
  if (sql) {
    try {
      const rows = await sql.query(
        `SELECT ${EDITION_COLS} ${EDITION_FROM} WHERE e.id = $1 AND coalesce(e.hidden, false) = false LIMIT 1`,
        [`${date}/${slug}`]
      );
      const r = (rows as Row[])[0];
      if (r) return rowToEdition(r);
    } catch {
      /* fall through */
    }
  }
  return (await getCatalog()).find((e) => e.date === date && e.slug === slug);
}

// Pro file keys for an edition (not exposed on the public Edition type). Used by the gated
// MCP Pro tool. Returns null if no DB / not found.
export async function getEditionProKeys(date: string, slug: string): Promise<{ proHtml: string; proPdf: string } | null> {
  if (!sql) return null;
  try {
    const rows = (await sql.query(
      `SELECT coalesce(pro_html_key, '') AS pro_html_key, coalesce(pro_pdf_key, '') AS pro_pdf_key
         FROM editions WHERE id = $1 AND coalesce(hidden, false) = false LIMIT 1`,
      [`${date}/${slug}`]
    )) as Row[];
    const r = rows[0];
    if (!r) return null;
    return { proHtml: s(r.pro_html_key), proPdf: s(r.pro_pdf_key) };
  } catch {
    return null;
  }
}

// Open-call predictions, with the T12 verdict + pred_type columns when they exist.
// Tried first; if those columns aren't migrated yet the query throws and we retry the
// original (pre-T12) projection so the DB path keeps working.
const OPEN_CALLS_FROM = `FROM open_calls oc
   LEFT JOIN open_call_predictions p ON p.report_id = oc.report_id
   GROUP BY oc.report_id, oc.instrument, oc.symbol, oc.view, oc.confidence,
            oc.window_end, oc.n, oc.n_manual, oc.hits, oc.scored
   ORDER BY oc.window_end`;
const OPEN_CALLS_HEAD = `SELECT oc.report_id, oc.instrument, oc.symbol, oc.view, oc.confidence,
          oc.window_end, oc.n, oc.n_manual, oc.hits, oc.scored,`;
const predAgg = (extra: string) => `coalesce(
    json_agg(
      json_build_object('id', p.pred_id, 'type', p.type, 'text', p.text,
                        'manual', p.manual, 'expect', p.expect${extra})
      order by p.seq
    ) filter (where p.id is not null), '[]'
  ) AS predictions`;

async function _getTrackRecord(): Promise<TrackRecord> {
  if (sql) {
    try {
      let openRows: Row[];
      try {
        openRows = (await sql.query(
          `${OPEN_CALLS_HEAD} ${predAgg(", 'verdict', coalesce(p.verdict, ''), 'predType', coalesce(p.pred_type, '')")} ${OPEN_CALLS_FROM}`
        )) as Row[];
      } catch {
        // pred_type / verdict columns not present yet — fall back to the base projection.
        openRows = (await sql.query(`${OPEN_CALLS_HEAD} ${predAgg("")} ${OPEN_CALLS_FROM}`)) as Row[];
      }

      // Scored rows, enriched with edition taxonomy (asset_class_key / prediction_type /
      // market_regime) via the same report_id derivation used elsewhere. Best-effort: if
      // those columns aren't migrated, retry without them so scoring data still loads.
      const SCORED_BASE = `SELECT sr.report_id, sr.instrument, sr.view, sr.confidence, sr.results,
                sr.hits, sr.misses, sr.hit_rate, sr.window_end`;
      const SCORED_JOIN = `FROM scored_results sr
         LEFT JOIN editions e
           ON sr.report_id = 'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug
         ORDER BY sr.id`;
      let scoredRows: Row[];
      try {
        scoredRows = (await sql.query(
          `${SCORED_BASE}, e.ticker AS ticker,
              coalesce(e.asset_class_key, '') AS asset_class_key,
              coalesce(e.prediction_type, '') AS prediction_type,
              coalesce(e.market_regime, '')  AS market_regime
           ${SCORED_JOIN}`
        )) as Row[];
      } catch {
        scoredRows = (await sql.query(
          `SELECT report_id, instrument, view, confidence, results, hits, misses, hit_rate, window_end
           FROM scored_results ORDER BY id`
        )) as Row[];
      }

      const open: OpenCall[] = openRows.map((r) => ({
        reportId: s(r.report_id), instrument: s(r.instrument), symbol: s(r.symbol),
        view: s(r.view), confidence: s(r.confidence), windowEnd: s(r.window_end),
        n: Number(r.n) || 0, nManual: Number(r.n_manual) || 0,
        hits: Number(r.hits) || 0, scored: Boolean(r.scored),
        predictions: Array.isArray(r.predictions) ? (r.predictions as SubCall[]) : [],
      }));
      const scored: ScoredRow[] = scoredRows.map((r) => ({
        instrument: s(r.instrument), view: s(r.view), confidence: s(r.confidence),
        results: s(r.results), hitRate: s(r.hit_rate), windowEnd: s(r.window_end),
        assetClass: s(r.asset_class_key), predType: s(r.prediction_type),
      }));
      const hits = scoredRows.reduce((a, r) => a + (Number(r.hits) || 0), 0);
      const misses = scoredRows.reduce((a, r) => a + (Number(r.misses) || 0), 0);
      const graded = hits + misses;
      // Build the derived analytics from the enriched scored rows (taxonomy keys present
      // only where the join + columns resolved; missing ones just drop out of the groupings).
      const aggregates = buildAggregates(scoredRows.map((r) => ({
        reportId: s(r.report_id), instrument: s(r.instrument), confidence: r.confidence,
        hits: r.hits, misses: r.misses, windowEnd: s(r.window_end), ticker: s(r.ticker),
        assetClass: s(r.asset_class_key), predType: s(r.prediction_type), regime: s(r.market_regime),
      })));
      return {
        stats: {
          reportsScored: scored.length, openCalls: open.length, predictionsGraded: graded,
          hitRate: graded ? Math.round((1000 * hits) / graded) / 10 : null,
          ...streaks(open),
        },
        open, scored, calibration: computeCalibration(scoredRows), ...aggregates,
      };
    } catch {
      /* fall through */
    }
  }
  const fallback = readJson<TrackRecord>("track-record.json", {
    stats: { reportsScored: 0, openCalls: 0, predictionsGraded: 0, hitRate: null, longestStreak: 0, currentStreak: 0 },
    open: [], scored: [], calibration: null,
  });
  // The export writes the aggregates; if an older JSON lacks them, derive from scored rows so
  // the page still has data. Prefer the file's own arrays when present.
  const derived = fallback.byInstrument === undefined
    ? buildAggregates((fallback.scored || []).map((r) => ({
        reportId: r.reportId, instrument: r.instrument, confidence: r.confidence,
        hits: r.hits, misses: r.misses, windowEnd: r.windowEnd,
        assetClass: r.assetClass, predType: r.predType,
      })))
    : {};
  return { ...derived, ...fallback, stats: { ...fallback.stats, ...streaks(fallback.open || []) } };
}

function computeCalibration(rows: Row[]): TrackRecord["calibration"] {
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

function buildAggregates(rows: ScoredLike[]): Required<Pick<TrackRecord,
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

// Cached reads: the catalog and track record aren't user-specific, so serve them
// from Next's Data Cache for `revalidate` seconds. Reloads (even on dynamic pages
// like /account or /admin) reuse the cached result instead of re-querying Neon.
export const getCatalog = unstable_cache(_getCatalog, ["catalog"], { revalidate: 300, tags: ["content"] });
export const getTrackRecord = unstable_cache(_getTrackRecord, ["track-record"], { revalidate: 300, tags: ["content"] });

// Most-viewed editions over the last 7 days (powers the "Popular this week" rail). Returns
// [] when the DB or report_views table isn't there yet, so the rail just hides.
async function _getTrending(limit = 6): Promise<Edition[]> {
  if (!sql) return [];
  try {
    const rows = await sql.query(
      `WITH top AS (
         SELECT edition_id, SUM(count) AS views
         FROM report_views
         WHERE day >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY edition_id
         ORDER BY views DESC
         LIMIT $1
       )
       SELECT ${EDITION_COLS}
       FROM top t
       JOIN editions e ON e.id = t.edition_id
       LEFT JOIN open_calls oc ON oc.report_id = 'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug
       WHERE coalesce(e.hidden, false) = false
       ORDER BY t.views DESC`,
      [limit]
    );
    return (rows as Row[]).map(rowToEdition);
  } catch {
    return [];
  }
}
export const getTrending = unstable_cache(_getTrending, ["trending"], { revalidate: 300, tags: ["content"] });
