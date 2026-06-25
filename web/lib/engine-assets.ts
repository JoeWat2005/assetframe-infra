import "server-only";
import { sql } from "./db";

// The dashboard-editable asset universe (engine_assets). The admin edits these rows; a `sync_assets`
// box command pushes them to config/assets.json on the box (after the engine validates them). Mirrors
// scripts/config_loader.py. Read layer only — mutations are admin server actions in app/admin/actions.ts.

export type EngineAsset = {
  id: string;
  name: string;
  instrument: string;
  ticker: string;
  providerSymbols: Record<string, string>;
  assetClass: string;
  sessionProfile: string;
  cadence: string;
  timezone: string;
  rollUtc: number;
  related: string;
  forecastWindow: string;
  publishPolicy: string; // approval_required | auto
  reportTier: string;
  enabled: boolean;
  sortOrder: number;
  due: boolean | null; // computed by the box's compute_due; null = not checked yet
  dueReason: string;
  dueCheckedAt: string; // "YYYY-MM-DD HH:MI" UTC, or ""
  cadenceDay: string; // weekly target day "0".."6" (Mon=0) or "mon".."sun"; "" = default Monday
  timeframes: string[]; // multi-timeframe tracks; [] = use forecastWindow
  chartIntervals: string[]; // candle intervals the view is analysed from; [] = ["60m","1d"]
  includeFundamentals: boolean | null; // null = engine default (equities only)
  includeNews: boolean;
  fundamentalsSource: string; // auto | twelvedata | none
};

const s = (v: unknown): string => (v == null ? "" : String(v));

const BASE_COLS = `id, name, instrument, ticker, provider_symbols, asset_class, session_profile, cadence,
              timezone, roll_utc, related, forecast_window, publish_policy, report_tier, enabled, sort_order`;
const DUE_COLS = `, due, coalesce(due_reason, '') AS due_reason,
              to_char(due_checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS due_checked_at`;
const MT_COLS = `, cadence_day, timeframes, include_fundamentals, include_news, fundamentals_source, chart_intervals`;

// jsonb `timeframes` can arrive as a parsed JS array or as a string; tolerate both.
function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
  }
  return [];
}

export async function getEngineAssets(): Promise<EngineAsset[]> {
  if (!sql) return [];
  let rows: Record<string, unknown>[] | null = null;
  // Richest projection first (due + multi-timeframe cols), degrading if a later migration hasn't
  // been applied yet, so the table always renders.
  for (const proj of [BASE_COLS + DUE_COLS + MT_COLS, BASE_COLS + DUE_COLS, BASE_COLS]) {
    try {
      rows = (await sql.query(`SELECT ${proj} FROM engine_assets ORDER BY sort_order, id`)) as Record<string, unknown>[];
      break;
    } catch {
      rows = null;
    }
  }
  if (rows == null) return []; // table not migrated yet
  return rows.map((r) => ({
    id: s(r.id),
    name: s(r.name),
    instrument: s(r.instrument),
    ticker: s(r.ticker),
    providerSymbols: (r.provider_symbols ?? {}) as Record<string, string>,
    assetClass: s(r.asset_class),
    sessionProfile: s(r.session_profile),
    cadence: s(r.cadence),
    timezone: s(r.timezone),
    rollUtc: Number(r.roll_utc) || 0,
    related: s(r.related),
    forecastWindow: s(r.forecast_window),
    publishPolicy: s(r.publish_policy),
    reportTier: s(r.report_tier),
    enabled: Boolean(r.enabled),
    sortOrder: Number(r.sort_order) || 0,
    due: r.due == null ? null : Boolean(r.due),
    dueReason: s(r.due_reason),
    dueCheckedAt: s(r.due_checked_at),
    cadenceDay: s(r.cadence_day),
    timeframes: asArr(r.timeframes),
    chartIntervals: asArr(r.chart_intervals),
    includeFundamentals: r.include_fundamentals == null ? null : Boolean(r.include_fundamentals),
    includeNews: r.include_news == null ? true : Boolean(r.include_news),
    fundamentalsSource: s(r.fundamentals_source) || "auto",
  }));
}
