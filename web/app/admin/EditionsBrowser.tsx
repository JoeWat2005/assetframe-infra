"use client";
import { useEffect, useMemo, useState } from "react";
import type { Edition } from "@/lib/content";
import { ASSET_CATEGORIES, assetCategory } from "@/lib/taxonomy";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import EditionToggle from "./EditionToggle";

const VIS: [string, string][] = [["all", "All"], ["live", "Live"], ["hidden", "Hidden"]];
const SORTS: [string, string][] = [
  ["newest", "Newest first"], ["oldest", "Oldest first"],
  ["conf-high", "Confidence: high → low"], ["conf-low", "Confidence: low → high"],
  ["az", "Instrument A–Z"],
];
const PAGE = 20; // rows per page

// Filterable, paginated editions list: search by instrument/ticker/class/date, filter by
// asset class + visibility, and page through so the table stays light with hundreds of editions.
export default function EditionsBrowser({ editions }: { editions: Edition[] }) {
  const [q, setQ] = useState("");
  const [vis, setVis] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);

  const categoryOptions = useMemo<[string, string][]>(() => {
    const seen = new Set(editions.map((e) => assetCategory(e.assetClass)));
    return [["all", "All asset classes"], ...ASSET_CATEGORIES.filter((c) => seen.has(c)).map((c) => [c, c] as [string, string])];
  }, [editions]);

  const filtered = useMemo(
    () =>
      editions.filter((e) => {
        if (vis === "live" && e.hidden) return false;
        if (vis === "hidden" && !e.hidden) return false;
        if (category !== "all" && assetCategory(e.assetClass) !== category) return false;
        if (q) {
          const hay = `${e.instrument} ${e.ticker} ${e.assetClass} ${e.reportDate}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [editions, q, vis, category]
  );

  const sorted = useMemo(() => {
    const conf = (e: Edition) => { const n = Number(e.confidence); return Number.isFinite(n) ? n : -1; };
    const arr = [...filtered];
    if (sort === "az") arr.sort((a, b) => a.instrument.localeCompare(b.instrument));
    else if (sort === "conf-high") arr.sort((a, b) => conf(b) - conf(a));
    else if (sort === "conf-low") arr.sort((a, b) => conf(a) - conf(b));
    else arr.sort((a, b) => (sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    return arr;
  }, [filtered, sort]);

  useEffect(() => { setPage(0); }, [q, vis, category, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          aria-label="Search editions by instrument, ticker or class"
          placeholder="Search instrument, ticker, class…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Asset class" className="w-full sm:w-auto sm:min-w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            {categoryOptions.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
        <Select value={vis} onValueChange={setVis}>
          <SelectTrigger aria-label="Visibility" className="w-full sm:w-auto sm:min-w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            {VIS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label="Sort by" className="w-full sm:w-auto sm:min-w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            {SORTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </div>

      {editions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-tile/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing to show — no editions published yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-tile/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing to show — no editions match your search.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {pageRows.map((e) => (
            <div
              key={`${e.date}/${e.slug}`}
              className="flex items-center justify-between gap-3 border-b border-line p-3 text-sm last:border-0"
            >
              <span className="min-w-0 truncate">
                <b>{e.instrument}</b> <span className="text-muted-foreground">{e.ticker}</span>
                <span className="ml-2 whitespace-nowrap text-muted-foreground">
                  {e.reportDate} · {assetCategory(e.assetClass)} · {e.hasPro ? "Pro ✓" : "free only"}
                </span>
              </span>
              <EditionToggle id={`${e.date}/${e.slug}`} hidden={e.hidden} />
            </div>
          ))}
        </div>
      )}

      {editions.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {filtered.length === 0 ? 0 : safePage * PAGE + 1}–{safePage * PAGE + pageRows.length} of {filtered.length}
            {filtered.length !== editions.length ? ` (filtered from ${editions.length})` : ""}
          </span>
          {pageCount > 1 && (
            <span className="flex items-center gap-2">
              <Button aria-label="Previous page" variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
              <span>Page {safePage + 1} / {pageCount}</span>
              <Button aria-label="Next page" variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</Button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
