"use client";
import { useEffect, useMemo, useState } from "react";
import type { ScoredRow } from "@/lib/content";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PAGE = 25; // rows per page
const SORTS: [string, string][] = [
  ["newest", "Newest first"], ["oldest", "Oldest first"],
  ["conf-high", "Confidence: high → low"], ["conf-low", "Confidence: low → high"],
  ["hit-high", "Hit rate: high → low"], ["hit-low", "Hit rate: low → high"],
  ["az", "Instrument A–Z"],
];

// Scored ledger rows (append-only, grows ~1/edition), sortable + paginated.
export default function ScoredResults({ rows }: { rows: ScoredRow[] }) {
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const num = (v: ScoredRow["confidence"]) => { const n = Number(v); return Number.isFinite(n) ? n : -1; };
    const w = (r: ScoredRow) => r.windowEnd || "";
    const arr = [...rows];
    if (sort === "az") arr.sort((a, b) => a.instrument.localeCompare(b.instrument));
    else if (sort === "conf-high") arr.sort((a, b) => num(b.confidence) - num(a.confidence));
    else if (sort === "conf-low") arr.sort((a, b) => num(a.confidence) - num(b.confidence));
    else if (sort === "hit-high") arr.sort((a, b) => num(b.hitRate) - num(a.hitRate));
    else if (sort === "hit-low") arr.sort((a, b) => num(a.hitRate) - num(b.hitRate));
    else arr.sort((a, b) => (sort === "oldest" ? w(a).localeCompare(w(b)) : w(b).localeCompare(w(a))));
    return arr;
  }, [rows, sort]);

  useEffect(() => { setPage(0); }, [sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label="Sort scored results" className="w-full sm:w-auto sm:min-w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            {SORTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full overflow-hidden rounded-xl border border-line bg-white text-sm">
          <thead className="bg-tile text-navy">
            <tr>
              <th className="p-3 text-left">Instrument</th><th className="p-3 text-left">View</th>
              <th className="p-3 text-left">Conf.</th><th className="p-3 text-left">Results</th>
              <th className="p-3 text-left">Hit rate</th><th className="p-3 text-left">Window end</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const good = Number(r.hitRate) >= 50;
              return (
                <tr key={`${r.instrument}-${r.windowEnd}-${safePage * PAGE + i}`} className="border-t border-line">
                  <td className="p-3"><b>{r.instrument}</b></td><td className="p-3">{r.view}</td>
                  <td className="p-3">{r.confidence}</td><td className="p-3">{r.results}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${good ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#ffebe9] text-[#cf222e]"}`}>{r.hitRate}%</span></td>
                  <td className="p-3">{r.windowEnd}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{safePage * PAGE + 1}–{safePage * PAGE + pageRows.length} of {sorted.length} scored</span>
        {pageCount > 1 && (
          <span className="flex items-center gap-2">
            <Button aria-label="Previous page" variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
            <span>Page {safePage + 1} / {pageCount}</span>
            <Button aria-label="Next page" variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</Button>
          </span>
        )}
      </div>
    </>
  );
}
