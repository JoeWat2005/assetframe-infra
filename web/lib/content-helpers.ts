import fs from "node:fs";
import path from "node:path";

// ------------------------------------------------------------------ JSON fallback
const CONTENT = path.join(process.cwd(), "content");
export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONTENT, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------ row mappers
export type Row = Record<string, unknown>;
export const s = (v: unknown): string => (v == null ? "" : String(v));

// Multi-timeframe horizon, derived from the report_id tag (AF-<date><TAG>-<TICKER>). The engine
// tags non-primary timeframe tracks: "MS"=multi_session, "H"=intraday; no tag = next_session.
export function horizonOf(reportId: string): string {
  const mid = (reportId || "").split("-")[1] || "";
  const tag = mid.replace(/[0-9]/g, "").toUpperCase();
  return tag === "MS" ? "multi_session" : tag === "H" ? "intraday" : "next_session";
}

// Scoring cadence, derived from the report_id period stamp (AF-<stamp>-<TICKER>): a "W" in the
// stamp = weekly (AF-YYYYWww), a 6-digit stamp = monthly (AF-YYYYMM), else daily (AF-YYYYMMDD /
// AF-YYYYMMDDHHMM). Mirror of export_content.cadence_of(). Used when scored_cadence is absent.
export function cadenceOf(reportId: string): string {
  const stamp = (reportId || "").split("-")[1] || "";
  if (stamp.toUpperCase().includes("W")) return "weekly";
  if (/^[0-9]{6}$/.test(stamp)) return "monthly";
  return "daily";
}
