"use client";
import { useEffect, useMemo, useState } from "react";
import type { Edition } from "@/lib/content";
import { filterEditions, sortEditions, type SortKey } from "@/lib/search";
import {
  ASSET_CATEGORIES, DIRECTIONS, CONFIDENCE_BANDS, CONFIDENCE_BAND_LABEL, RISK_LEVELS,
  assetCategory, biasDirection, confidenceBand,
} from "@/lib/taxonomy";
import ReportCard from "@/components/ReportCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SORTS: [SortKey, string][] = [
  ["newest", "Newest first"], ["oldest", "Oldest first"],
  ["conf-high", "Confidence: high → low"], ["conf-low", "Confidence: low → high"],
  ["instrument", "Instrument A–Z"],
];
const PAGE = 12; // how many cards render before "Show more"

// "15 Jun 2026" for the date dropdown; falls back to the raw ISO if it can't parse.
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return y && m && d ? `${d} ${months[m - 1]} ${y}` : iso;
}

function PickList({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function ReportsBrowser({ editions }: { editions: Edition[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [risk, setRisk] = useState("all");
  const [date, setDate] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [shown, setShown] = useState(PAGE);

  // Options show only the buckets actually present in the catalog, in canonical enum order.
  const present = <T extends string>(canon: readonly T[], of: (e: Edition) => T | null | "Other") => {
    const seen = new Set(editions.map(of));
    return canon.filter((c) => seen.has(c));
  };
  const categoryOptions = useMemo<[string, string][]>(
    () => [["all", "All asset classes"], ...present(ASSET_CATEGORIES, (e) => assetCategory(e.assetClass)).map((c) => [c, c] as [string, string])],
    [editions] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const directionOptions = useMemo<[string, string][]>(
    () => [["all", "Any direction"], ...present(DIRECTIONS, (e) => biasDirection(e.bias)).map((d) => [d, d] as [string, string])],
    [editions] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const confidenceOptions = useMemo<[string, string][]>(
    () => [["all", "Any confidence"], ...present(CONFIDENCE_BANDS, (e) => confidenceBand(e.confidence)).map((b) => [b, CONFIDENCE_BAND_LABEL[b]] as [string, string])],
    [editions] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const riskOptions = useMemo<[string, string][]>(
    () => [["all", "Any risk"], ...present(RISK_LEVELS, (e) => (RISK_LEVELS.find((r) => r.toLowerCase() === (e.risk || "").toLowerCase()) ?? null)).map((r) => [r, `Risk: ${r}`] as [string, string])],
    [editions] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const dateOptions = useMemo<[string, string][]>(
    () => [["all", "All dates"], ...Array.from(new Set(editions.map((e) => e.date).filter(Boolean))).sort().reverse().map((d) => [d, fmtDate(d)] as [string, string])],
    [editions]
  );

  // Selecting a confidence band ranks results highest → lowest (industry-standard: most
  // confident first), unless the user then picks a different sort.
  const onConfidence = (v: string) => {
    setConfidence(v);
    if (v !== "all") setSort("conf-high");
  };

  const results = useMemo(() => {
    const filtered = filterEditions(editions, {
      q,
      category: category === "all" ? "" : category,
      direction: direction === "all" ? "" : direction,
      confidence: confidence === "all" ? "" : confidence,
      risk: risk === "all" ? "" : risk,
      from: date === "all" ? "" : date, // exact-day match (from == to)
      to: date === "all" ? "" : date,
    });
    return sortEditions(filtered, sort);
  }, [editions, q, category, direction, confidence, risk, date, sort]);

  // Reset the visible window whenever the result set changes (new filter/search).
  useEffect(() => { setShown(PAGE); }, [q, category, direction, confidence, risk, date, sort]);

  const active = q || category !== "all" || direction !== "all" || confidence !== "all" || risk !== "all" || date !== "all";
  const clearAll = () => {
    setQ(""); setCategory("all"); setDirection("all"); setConfidence("all"); setRisk("all"); setDate("all"); setSort("newest");
  };
  const visible = results.slice(0, shown);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search instrument or ticker…"
          className="sm:max-w-xs"
        />
        <PickList value={category} onChange={setCategory} options={categoryOptions} />
        <PickList value={direction} onChange={setDirection} options={directionOptions} />
        <PickList value={confidence} onChange={onConfidence} options={confidenceOptions} />
        <PickList value={risk} onChange={setRisk} options={riskOptions} />
        <PickList value={date} onChange={setDate} options={dateOptions} />
        <PickList value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS} />
        {active && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {results.length} report{results.length === 1 ? "" : "s"}
        {active ? " match your filters" : ""}
        {results.length > visible.length ? ` · showing ${visible.length}` : ""}
      </p>

      {results.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No reports match — try clearing the filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((e) => <ReportCard key={`${e.date}/${e.slug}`} e={e} animate={false} />)}
          </div>
          {results.length > visible.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({results.length - visible.length} more)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
