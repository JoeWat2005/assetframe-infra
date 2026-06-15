"use client";
import { useState } from "react";
import type { ScoredRow } from "@/lib/content";
import { Button } from "@/components/ui/button";

const PAGE = 25; // rows per page

// Scored ledger rows (append-only, grows ~1/edition), paginated so the table stays light.
export default function ScoredResults({ rows }: { rows: ScoredRow[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <>
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
        <span>{safePage * PAGE + 1}–{safePage * PAGE + pageRows.length} of {rows.length} scored</span>
        {pageCount > 1 && (
          <span className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
            <span>Page {safePage + 1} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</Button>
          </span>
        )}
      </div>
    </>
  );
}
