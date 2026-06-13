"use client";
import { useMemo, useState } from "react";
import type { Edition } from "@/lib/content";
import { filterEditions, sortEditions, type SortKey } from "@/lib/search";
import ReportCard from "@/components/ReportCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PERIODS: [string, string][] = [
  ["all", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"],
];
const SORTS: [SortKey, string][] = [
  ["newest", "Newest first"], ["oldest", "Oldest first"], ["instrument", "Instrument A–Z"],
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function PickList({
  value, onChange, placeholder, options,
}: { value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function ReportsBrowser({ editions }: { editions: Edition[] }) {
  const [q, setQ] = useState("");
  const [assetClass, setAssetClass] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const assetOptions = useMemo<[string, string][]>(
    () => [["all", "All asset classes"],
      ...Array.from(new Set(editions.map((e) => e.assetClass).filter(Boolean))).sort().map((a) => [a, a] as [string, string])],
    [editions]
  );
  const statusOptions = useMemo<[string, string][]>(
    () => [["all", "Any status"],
      ...Array.from(new Set(editions.map((e) => e.status).filter(Boolean))).sort().map((s) => [s, s] as [string, string])],
    [editions]
  );

  const results = useMemo(() => {
    const from = period === "all" ? "" : daysAgo(Number(period));
    const filtered = filterEditions(editions, {
      q, assetClass: assetClass === "all" ? "" : assetClass,
      status: status === "all" ? "" : status, from,
    });
    return sortEditions(filtered, sort);
  }, [editions, q, assetClass, status, period, sort]);

  const active = q || assetClass !== "all" || status !== "all" || period !== "all";
  const clearAll = () => { setQ(""); setAssetClass("all"); setStatus("all"); setPeriod("all"); setSort("newest"); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search instrument or ticker…"
          className="sm:max-w-xs"
        />
        <PickList value={assetClass} onChange={setAssetClass} placeholder="All asset classes" options={assetOptions} />
        <PickList value={status} onChange={setStatus} placeholder="Any status" options={statusOptions} />
        <PickList value={period} onChange={setPeriod} placeholder="All time" options={PERIODS} />
        <PickList value={sort} onChange={(v) => setSort(v as SortKey)} placeholder="Sort" options={SORTS} />
        {active && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {results.length} report{results.length === 1 ? "" : "s"}
        {active ? " match your filters" : ""}
      </p>

      {results.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No reports match — try clearing the filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((e) => <ReportCard key={`${e.date}/${e.slug}`} e={e} />)}
        </div>
      )}
    </div>
  );
}
