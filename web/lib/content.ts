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
};
export type TrackRecord = {
  stats: {
    reportsScored: number; openCalls: number; predictionsGraded: number; hitRate: number | null;
    longestStreak: number; currentStreak: number;
  };
  open: OpenCall[]; scored: ScoredRow[];
  calibration: Record<string, { hitRate: number | null; n: number }> | null;
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

async function _getTrackRecord(): Promise<TrackRecord> {
  if (sql) {
    try {
      const openRows = (await sql.query(
        `SELECT oc.report_id, oc.instrument, oc.symbol, oc.view, oc.confidence,
                oc.window_end, oc.n, oc.n_manual, oc.hits, oc.scored,
                coalesce(
                  json_agg(
                    json_build_object('id', p.pred_id, 'type', p.type, 'text', p.text,
                                      'manual', p.manual, 'expect', p.expect)
                    order by p.seq
                  ) filter (where p.id is not null),
                  '[]'
                ) AS predictions
         FROM open_calls oc
         LEFT JOIN open_call_predictions p ON p.report_id = oc.report_id
         GROUP BY oc.report_id, oc.instrument, oc.symbol, oc.view, oc.confidence,
                  oc.window_end, oc.n, oc.n_manual, oc.hits, oc.scored
         ORDER BY oc.window_end`
      )) as Row[];
      const scoredRows = (await sql.query(
        // Order by the serial id (insert order = ledger/CSV order) rather than
        // scored_at (a now() stamp that re-sync rewrites), so streaks match the JSON path.
        `SELECT instrument, view, confidence, results, hits, misses, hit_rate, window_end
         FROM scored_results ORDER BY id`
      )) as Row[];

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
      }));
      const hits = scoredRows.reduce((a, r) => a + (Number(r.hits) || 0), 0);
      const misses = scoredRows.reduce((a, r) => a + (Number(r.misses) || 0), 0);
      const graded = hits + misses;
      return {
        stats: {
          reportsScored: scored.length, openCalls: open.length, predictionsGraded: graded,
          hitRate: graded ? Math.round((1000 * hits) / graded) / 10 : null,
          ...streaks(open),
        },
        open, scored, calibration: computeCalibration(scoredRows),
      };
    } catch {
      /* fall through */
    }
  }
  const fallback = readJson<TrackRecord>("track-record.json", {
    stats: { reportsScored: 0, openCalls: 0, predictionsGraded: 0, hitRate: null, longestStreak: 0, currentStreak: 0 },
    open: [], scored: [], calibration: null,
  });
  return { ...fallback, stats: { ...fallback.stats, ...streaks(fallback.open || []) } };
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

// Cached reads: the catalog and track record aren't user-specific, so serve them
// from Next's Data Cache for `revalidate` seconds. Reloads (even on dynamic pages
// like /account or /admin) reuse the cached result instead of re-querying Neon.
export const getCatalog = unstable_cache(_getCatalog, ["catalog"], { revalidate: 300, tags: ["content"] });
export const getTrackRecord = unstable_cache(_getTrackRecord, ["track-record"], { revalidate: 300, tags: ["content"] });
