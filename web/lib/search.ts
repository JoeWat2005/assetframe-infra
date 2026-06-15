// Pure, dependency-free filtering/sorting for the reports browser. Kept separate from the
// data source so the UI never changes. Classification (category/direction/confidence band)
// is derived via lib/taxonomy so filtering matches the badges. Dates are ISO "YYYY-MM-DD",
// so lexicographic comparison = chronological.
import { assetCategory, biasDirection, confidenceBand } from "./taxonomy";

export type Filterable = {
  instrument: string;
  ticker: string;
  assetClass: string;
  bias: string;
  status: string;
  date: string;
  risk?: string;
  confidence?: number | null;
};

export type FilterOpts = {
  q?: string;
  category?: string; // broad AssetCategory (preferred for the UI)
  assetClass?: string; // exact granular asset_class match (legacy / precise)
  direction?: string; // Bullish | Bearish | Neutral
  confidence?: string; // band: High | Medium | Low
  risk?: string;
  status?: string;
  from?: string; // inclusive lower bound, YYYY-MM-DD
  to?: string; // inclusive upper bound, YYYY-MM-DD
};

export function filterEditions<T extends Filterable>(editions: T[], opts: FilterOpts): T[] {
  const q = (opts.q ?? "").trim().toLowerCase();

  return editions.filter((e) => {
    if (opts.category && assetCategory(e.assetClass) !== opts.category) return false;
    if (opts.assetClass && e.assetClass !== opts.assetClass) return false;
    if (opts.direction && biasDirection(e.bias) !== opts.direction) return false;
    if (opts.confidence && confidenceBand(e.confidence) !== opts.confidence) return false;
    if (opts.risk && (e.risk ?? "").toLowerCase() !== opts.risk.toLowerCase()) return false;
    if (opts.status && e.status !== opts.status) return false;
    if (opts.from && e.date < opts.from) return false;
    if (opts.to && e.date > opts.to) return false;
    if (q) {
      const haystack = `${e.instrument} ${e.ticker} ${e.assetClass} ${e.bias}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = "newest" | "oldest" | "instrument" | "conf-high" | "conf-low";

export function sortEditions<T extends Filterable>(editions: T[], key: SortKey): T[] {
  const out = [...editions];
  const conf = (e: T) => {
    const n = Number(e.confidence);
    return Number.isFinite(n) ? n : -1;
  };
  if (key === "instrument") {
    out.sort((a, b) => a.instrument.localeCompare(b.instrument));
  } else if (key === "conf-high") {
    out.sort((a, b) => conf(b) - conf(a) || b.date.localeCompare(a.date));
  } else if (key === "conf-low") {
    out.sort((a, b) => conf(a) - conf(b) || b.date.localeCompare(a.date));
  } else {
    out.sort((a, b) =>
      key === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    );
  }
  return out;
}
