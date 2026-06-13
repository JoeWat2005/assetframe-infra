// Pure, dependency-free filtering used by the reports browser. Kept separate from
// the data source (JSON today, Supabase later) so the UI never changes.
// Dates are ISO "YYYY-MM-DD" strings, so lexicographic comparison = chronological.
export type Filterable = {
  instrument: string;
  ticker: string;
  assetClass: string;
  bias: string;
  status: string;
  date: string;
};

export type FilterOpts = {
  q?: string;
  assetClass?: string;
  status?: string;
  from?: string; // inclusive lower bound, YYYY-MM-DD
  to?: string; // inclusive upper bound, YYYY-MM-DD
};

export function filterEditions<T extends Filterable>(editions: T[], opts: FilterOpts): T[] {
  const q = (opts.q ?? "").trim().toLowerCase();
  const assetClass = opts.assetClass ?? "";
  const status = opts.status ?? "";
  const from = opts.from ?? "";
  const to = opts.to ?? "";

  return editions.filter((e) => {
    if (assetClass && e.assetClass !== assetClass) return false;
    if (status && e.status !== status) return false;
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (q) {
      const haystack = `${e.instrument} ${e.ticker} ${e.assetClass} ${e.bias}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = "newest" | "oldest" | "instrument";

export function sortEditions<T extends Filterable>(editions: T[], key: SortKey): T[] {
  const out = [...editions];
  if (key === "instrument") {
    out.sort((a, b) => a.instrument.localeCompare(b.instrument));
  } else {
    out.sort((a, b) =>
      key === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    );
  }
  return out;
}
