// Shared classification taxonomy. The pipeline emits free-text `asset_class`, `bias` and
// `status`; these enums + pure mappers bucket them into a small, filterable set so the
// reports browser, track record and admin all classify identically. No deps — server+client.

export const ASSET_CATEGORIES = ["Crypto", "FX", "Commodities", "Indices", "Stocks"] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** Map a granular `asset_class` string (e.g. "Spot FX (G10 carry major)") to one broad category. */
export function assetCategory(assetClass: string): AssetCategory | "Other" {
  const a = (assetClass || "").toLowerCase();
  if (a.includes("crypto")) return "Crypto";
  if (a.includes("commodity") || a.includes("metal") || a.includes("energy") ||
      a.includes("oil") || a.includes("crude") || a.includes("gold") || a.includes("silver")) return "Commodities";
  if (a.includes("dollar index") || a.includes("fx") || a.includes("forex")) return "FX";
  if (a.includes("index future") || a.includes("equity index")) return "Indices";
  if (a.includes("single stock") || a.includes("equity")) return "Stocks";
  return "Other";
}

export const DIRECTIONS = ["Bullish", "Bearish", "Neutral"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Derive a directional lean from the free-text `bias` (e.g. "Constructive-lean (conditional)"). */
export function biasDirection(bias: string): Direction {
  const b = (bias || "").toLowerCase();
  if (/(bull|long|constructive|upside|up-lean)/.test(b)) return "Bullish";
  if (/(bear|short|downside|down-lean)/.test(b)) return "Bearish";
  return "Neutral";
}

export const CONFIDENCE_BANDS = ["High", "Medium", "Low"] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

/** Bucket a 0–100 confidence into a band, or null if absent. */
export function confidenceBand(c: number | string | null | undefined): ConfidenceBand | null {
  const n = typeof c === "number" ? c : Number(c);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 65) return "High";
  if (n >= 50) return "Medium";
  return "Low";
}

export const CONFIDENCE_BAND_LABEL: Record<ConfidenceBand, string> = {
  High: "High conviction (65+)",
  Medium: "Moderate (50–64)",
  Low: "Lower (<50)",
};

export const RISK_LEVELS = ["Low", "Medium", "High", "Very High"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
