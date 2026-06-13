"use client";
import { useMemo, useState } from "react";
import type { Edition } from "@/lib/content";
import { filterEditions } from "@/lib/search";
import { Badge, Btn } from "@/components/ui";

const selectCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm sm:w-auto";

export default function ReportsBrowser({ editions }: { editions: Edition[] }) {
  const [q, setQ] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const assetClasses = useMemo(
    () => Array.from(new Set(editions.map((e) => e.assetClass).filter(Boolean))).sort(),
    [editions]
  );
  const statuses = useMemo(
    () => Array.from(new Set(editions.map((e) => e.status).filter(Boolean))).sort(),
    [editions]
  );
  const results = useMemo(
    () => filterEditions(editions, { q, assetClass, status, from, to }),
    [editions, q, assetClass, status, from, to]
  );
  const active = q || assetClass || status || from || to;
  const clearAll = () => { setQ(""); setAssetClass(""); setStatus(""); setFrom(""); setTo(""); };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search instrument or ticker…"
          aria-label="Search reports"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm sm:max-w-xs"
        />
        <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)} aria-label="Asset class" className={selectCls}>
          <option value="">All asset classes</option>
          {assetClasses.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={selectCls}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className={selectCls} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className={selectCls} />
        </label>
        {active && (
          <button onClick={clearAll} className="text-sm font-semibold text-muted hover:text-navy">
            Clear
          </button>
        )}
      </div>

      <p className="mt-3 text-sm text-muted">
        {results.length} report{results.length === 1 ? "" : "s"}
        {active ? " match your filters" : ""}
      </p>

      {results.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No reports match — try clearing the filters.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((e) => (
            <div key={`${e.date}/${e.slug}`} className="flex flex-col rounded-xl border border-line bg-white p-4">
              <div className="text-lg font-bold">{e.instrument}</div>
              <div className="text-[13px] font-semibold text-muted">{e.ticker}</div>
              <div className="mt-0.5 text-xs text-[#8b949e]">{e.assetClass}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.status && <Badge label={e.status} kind="status" />}
                {e.risk && <Badge label={e.risk} kind="risk" />}
              </div>
              <div className="mt-2 text-sm">{e.bias}</div>
              <div className="mt-1 text-xs text-muted">Edition {e.reportDate} · window to {e.windowEnd}</div>
              {e.dataQuality !== "" && <div className="text-xs text-muted">Data quality {e.dataQuality}/10</div>}
              <div className="mt-3 flex flex-wrap gap-2 pt-1">
                <Btn href={e.freeHtml} variant="primary" external sm>Read Snapshot</Btn>
                <Btn href={e.freePdf} external sm>PDF</Btn>
                <Btn href={`/reports/${e.date}/${e.slug}`} variant="pro" sm>🔒 Pro</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
