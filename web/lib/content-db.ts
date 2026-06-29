import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import type {
  Edition, OpenCall, SubCall, ScoredRow, TrackRecord, HorizonPerf, CadencePerf,
} from "@/lib/content-types";
import type { Row } from "@/lib/content-helpers";
import { s, readJson, horizonOf, cadenceOf } from "@/lib/content-helpers";
import { buildAggregates, computeCalibration, streaks } from "@/lib/content-aggregates";

function rowToEdition(r: Row): Edition {
  const date = s(r.report_date).slice(0, 10);
  return {
    date, slug: s(r.slug), instrument: s(r.instrument), ticker: s(r.ticker),
    assetClass: s(r.asset_class), status: s(r.status), risk: s(r.risk), bias: s(r.bias),
    // Coerce a non-numeric / missing quality to "" (never NaN) so the UI doesn't render "NaN/10".
    lastPrice: "", dataQuality: Number.isFinite(Number(r.data_quality)) && r.data_quality != null ? Number(r.data_quality) : "",
    windowEnd: s(r.window_end), reportDate: date, catalystStatus: s(r.catalyst_status),
    freeHtml: s(r.free_html_key), freePdf: s(r.free_pdf_key), preview: s(r.preview_key),
    hasPro: Boolean(r.has_pro), hidden: Boolean(r.hidden),
    confidence: r.confidence == null || r.confidence === "" ? null : Number(r.confidence),
    reportId: s(r.report_id), scoredCadence: s(r.scored_cadence) || cadenceOf(s(r.report_id)),
    chartIntervals: Array.isArray(r.chart_intervals) ? (r.chart_intervals as string[]) : [],
    forecastWindow: s(r.forecast_window),
    dataProvider: s(r.data_provider), dataLicense: s(r.data_license),
    dataLicenseDegraded: Boolean(r.data_license_degraded),
  };
}

const EDITION_COLS = `e.id, e.report_date::text AS report_date, e.slug, e.instrument, e.ticker,
  e.asset_class, e.status, e.risk, e.bias, e.data_quality, e.window_end, e.catalyst_status, e.has_pro,
  e.free_html_key, e.free_pdf_key, e.preview_key, coalesce(e.hidden, false) AS hidden,
  e.report_id, coalesce(e.scored_cadence, '') AS scored_cadence, e.chart_intervals,
  coalesce(e.forecast_window, '') AS forecast_window,
  coalesce(e.data_provider, '') AS data_provider, coalesce(e.data_license, '') AS data_license,
  coalesce(e.data_license_degraded, false) AS data_license_degraded,
  oc.confidence AS confidence`;
// Confidence isn't on the editions table — join the open call by the edition's stored report_id
// (cadence-aware: AF-YYYYMMDD / AF-YYYYWww / AF-YYYYMM -TICKER). Falls back to the legacy daily-form
// derivation for any pre-cadence row that lacks the column. LEFT JOIN so editions without a
// registered call still return.
const EDITION_FROM = `FROM editions e
  LEFT JOIN open_calls oc
    ON oc.report_id = coalesce(e.report_id,
         'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug)`;

// ------------------------------------------------------------------ public API (DB-first)
// Wrapped in unstable_cache below so reloads serve from Next's Data Cache (no re-query).
export async function _getCatalog(): Promise<Edition[]> {
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

export async function _getTrackRecord(): Promise<TrackRecord> {
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
      // DISTINCT ON (sr.id): the editions join can match ONE scored row to TWO editions (the
      // exact report_id match AND a legacy null-report_id row whose derived id collides), which
      // would double-count that row's hits/misses. Collapse to one edition per scored row,
      // preferring the exact report_id match (e.report_id IS NULL sorts last). Same hit-rate
      // formula — this only removes the duplicate.
      const SCORED_BASE = `SELECT DISTINCT ON (sr.id) sr.report_id, sr.instrument, sr.view, sr.confidence, sr.results,
                sr.hits, sr.misses, sr.hit_rate, sr.window_end`;
      const SCORED_JOIN = `FROM scored_results sr
         LEFT JOIN editions e
           ON e.report_id = sr.report_id
           OR (e.report_id IS NULL
               AND sr.report_id = 'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug)
         ORDER BY sr.id, (e.report_id IS NULL)`;
      let scoredRows: Row[];
      try {
        scoredRows = (await sql.query(
          // Taxonomy comes from scored_results (denormalized by the engine — see
          // migration 1750000030000); fall back to the editions columns for any rows synced
          // before that change. Aliases are unchanged so the downstream mapping is untouched.
          `${SCORED_BASE}, coalesce(sr.scored_cadence, '') AS scored_cadence, e.ticker AS ticker,
              coalesce(nullif(sr.asset_class, ''),   e.asset_class_key, '') AS asset_class_key,
              coalesce(nullif(sr.pred_type, ''),     e.prediction_type, '') AS prediction_type,
              coalesce(nullif(sr.market_regime, ''), e.market_regime, '')   AS market_regime
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
        horizon: horizonOf(s(r.report_id)),
        scoredCadence: cadenceOf(s(r.report_id)),
      }));
      const scored: ScoredRow[] = scoredRows.map((r) => ({
        instrument: s(r.instrument), view: s(r.view), confidence: s(r.confidence),
        results: s(r.results), hitRate: s(r.hit_rate), windowEnd: s(r.window_end),
        assetClass: s(r.asset_class_key), predType: s(r.prediction_type),
        reportId: s(r.report_id), horizon: horizonOf(s(r.report_id)),
        scoredCadence: s(r.scored_cadence) || cadenceOf(s(r.report_id)),
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
      // by-horizon (multi-timeframe): horizon is encoded in the report_id tag, so no DB column needed.
      const hzAgg: Record<string, { reports: number; hits: number; misses: number }> = {};
      for (const r of scoredRows) {
        const b = (hzAgg[horizonOf(s(r.report_id))] ??= { reports: 0, hits: 0, misses: 0 });
        b.reports++; b.hits += Number(r.hits) || 0; b.misses += Number(r.misses) || 0;
      }
      const byHorizon: HorizonPerf[] = Object.entries(hzAgg).map(([horizon, b]) => ({
        horizon, reportsScored: b.reports, hits: b.hits, misses: b.misses,
        hitRate: b.hits + b.misses ? Math.round((1000 * b.hits) / (b.hits + b.misses)) / 10 : null,
      }));
      // by-cadence (daily/weekly/monthly): prefer the stored scored_cadence column, else derive
      // from the report_id period stamp. Same shape as byHorizon.
      const cadAgg: Record<string, { reports: number; hits: number; misses: number }> = {};
      for (const r of scoredRows) {
        const key = s(r.scored_cadence) || cadenceOf(s(r.report_id));
        const b = (cadAgg[key] ??= { reports: 0, hits: 0, misses: 0 });
        b.reports++; b.hits += Number(r.hits) || 0; b.misses += Number(r.misses) || 0;
      }
      const byCadence: CadencePerf[] = Object.entries(cadAgg).map(([cadence, b]) => ({
        cadence, reportsScored: b.reports, hits: b.hits, misses: b.misses,
        hitRate: b.hits + b.misses ? Math.round((1000 * b.hits) / (b.hits + b.misses)) / 10 : null,
      }));
      return {
        stats: {
          reportsScored: scored.length, openCalls: open.length, predictionsGraded: graded,
          hitRate: graded ? Math.round((1000 * hits) / graded) / 10 : null,
          ...streaks(open),
        },
        open, scored, calibration: computeCalibration(scoredRows), ...aggregates, byHorizon, byCadence,
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

// Cached read: the catalog isn't user-specific, so serve it from Next's Data Cache for
// `revalidate` seconds. Reloads reuse the cached result instead of re-querying Neon.
export const getCatalog = unstable_cache(_getCatalog, ["catalog"], { revalidate: 300, tags: ["content"] });

// Most-viewed editions over the last 7 days (powers the "Popular this week" rail). Returns
// [] when the DB or report_views table isn't there yet, so the rail just hides.
export async function _getTrending(limit = 6): Promise<Edition[]> {
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
       LEFT JOIN open_calls oc ON oc.report_id = coalesce(e.report_id, 'AF-' || replace(e.report_date::text, '-', '') || '-' || e.slug)
       WHERE coalesce(e.hidden, false) = false
       ORDER BY t.views DESC`,
      [limit]
    );
    return (rows as Row[]).map(rowToEdition);
  } catch {
    return [];
  }
}
