"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OpenCall } from "@/lib/content";
import {
  ASSET_CATEGORIES, CONFIDENCE_BANDS, CONFIDENCE_BAND_LABEL,
  assetCategory, confidenceBand,
} from "@/lib/taxonomy";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PAGE = 15; // rows before "Show more"
const SORTS: [string, string][] = [
  ["newest", "Newest first"], ["oldest", "Oldest first"],
  ["conf-high", "Confidence: high → low"], ["conf-low", "Confidence: low → high"],
  ["az", "Instrument A–Z"],
];

// Per-prediction outcome (merged from the ledger's packed results). Hidden until scored.
const VERDICTS: Record<string, { label: string; cls: string }> = {
  Y: { label: "Hit", cls: "bg-[#dafbe1] text-[#1a7f37]" },
  N: { label: "Miss", cls: "bg-[#ffebe9] text-[#cf222e]" },
  NT: { label: "No-trigger", cls: "bg-tile text-[#57606a]" },
  MANUAL: { label: "Awaiting", cls: "bg-[#fff7e6] text-[#9a6700]" },
};
function VerdictBadge({ verdict }: { verdict?: string }) {
  const v = (verdict || "").trim().toUpperCase();
  if (!v) return null;
  const m = VERDICTS[v] ?? { label: v, cls: "bg-tile text-[#57606a]" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>{m.label}</span>;
}

function PickList({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full sm:w-auto sm:min-w-[150px]">
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

export default function OpenCallsBrowser({
  open, assetClass = {},
}: { open: OpenCall[]; assetClass?: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [date, setDate] = useState("all");
  const [sort, setSort] = useState("newest");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);

  const categoryOf = (c: OpenCall) => assetCategory(assetClass[c.symbol] || "");
  const dateOf = (c: OpenCall) => (c.windowEnd || "").slice(0, 10);

  const categoryOptions = useMemo<[string, string][]>(() => {
    const seen = new Set(open.map(categoryOf));
    return [["all", "All asset classes"], ...ASSET_CATEGORIES.filter((x) => seen.has(x)).map((x) => [x, x] as [string, string])];
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const confidenceOptions = useMemo<[string, string][]>(() => {
    const seen = new Set(open.map((c) => confidenceBand(c.confidence)));
    return [["all", "Any confidence"], ...CONFIDENCE_BANDS.filter((b) => seen.has(b)).map((b) => [b, CONFIDENCE_BAND_LABEL[b]] as [string, string])];
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const dateOptions = useMemo<[string, string][]>(
    () => [["all", "All dates"], ...Array.from(new Set(open.map(dateOf))).filter(Boolean).sort().reverse().map((d) => [d, d] as [string, string])],
    [open] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return open.filter((c) => {
      if (category !== "all" && categoryOf(c) !== category) return false;
      if (confidence !== "all" && confidenceBand(c.confidence) !== confidence) return false;
      if (date !== "all" && dateOf(c) !== date) return false;
      if (needle) {
        const hay = `${c.instrument} ${c.symbol} ${c.view} ${(c.predictions || []).map((p) => p.text).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [open, q, category, confidence, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const conf = (c: OpenCall) => { const n = Number(c.confidence); return Number.isFinite(n) ? n : -1; };
    const w = (c: OpenCall) => c.windowEnd || "";
    const arr = [...filtered];
    if (sort === "az") arr.sort((a, b) => a.instrument.localeCompare(b.instrument));
    else if (sort === "conf-high") arr.sort((a, b) => conf(b) - conf(a));
    else if (sort === "conf-low") arr.sort((a, b) => conf(a) - conf(b));
    else arr.sort((a, b) => (sort === "oldest" ? w(a).localeCompare(w(b)) : w(b).localeCompare(w(a))));
    return arr;
  }, [filtered, sort]);

  useEffect(() => { setShown(PAGE); }, [q, category, confidence, date, sort]);

  // Drop expanded rows that are no longer visible (so they don't reopen on return).
  useEffect(() => {
    const visible = new Set(filtered.map((c) => c.reportId));
    setExpanded((prev) => {
      for (const id of prev) if (!visible.has(id)) return new Set([...prev].filter((x) => visible.has(x)));
      return prev;
    });
  }, [filtered]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const active = q || category !== "all" || confidence !== "all" || date !== "all";
  const clearAll = () => { setQ(""); setCategory("all"); setConfidence("all"); setDate("all"); };

  if (open.length === 0) {
    return <p className="text-sm text-muted-foreground">No prediction calls yet — the next edition opens the next set.</p>;
  }

  const visible = sorted.slice(0, shown);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          aria-label="Search calls or predictions"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search calls or predictions…"
          className="sm:max-w-xs"
        />
        <PickList label="Asset class" value={category} onChange={setCategory} options={categoryOptions} />
        <PickList label="Confidence" value={confidence} onChange={setConfidence} options={confidenceOptions} />
        <PickList label="Date" value={date} onChange={setDate} options={dateOptions} />
        <PickList label="Sort by" value={sort} onChange={setSort} options={SORTS} />
        {active && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">Clear</Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} call{filtered.length === 1 ? "" : "s"}
        {active ? " match your filters" : ""}
        {filtered.length > visible.length ? ` · showing ${visible.length}` : ""} · the badge shows predictions that came true (hits/total)
      </p>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No open calls match — try clearing the filters.</p>
        ) : (
          visible.map((c) => {
            const isOpen = expanded.has(c.reportId);
            const panelId = `call-${c.reportId}`;
            const won = c.scored && c.hits * 2 > c.n; // strict majority → counts to the streak
            const trackColor = !c.scored ? "#9a6700" : won ? "#1a7f37" : "#57606a";
            return (
              <div key={c.reportId} className="border-b border-line last:border-0">
                <button
                  onClick={() => toggle(c.reportId)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} prediction details for ${c.instrument}`}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-tile/60"
                >
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{c.instrument}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.symbol} · {categoryOf(c)} · {c.view}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="text-xs text-muted-foreground">
                      Conf. {c.confidence} · {c.n} prediction{c.n === 1 ? "" : "s"}{c.nManual ? ` (+${c.nManual} manual)` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.scored ? "window closed" : "scores after"} {c.windowEnd} UTC
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <Badge style={{ backgroundColor: trackColor }} className="border-transparent font-mono tabular-nums text-white">
                      {c.hits}/{c.n}
                    </Badge>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {c.scored ? (won ? "Majority" : "Scored") : "Pending"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div id={panelId} className="border-t border-line bg-tile/30 px-3 py-3 sm:pl-10">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Individual predictions
                    </div>
                    {(c.predictions || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No per-prediction detail stored for this call yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {c.predictions.map((p) => (
                          <li key={p.id} className="flex gap-2.5 rounded-lg border border-line bg-white p-2.5 text-sm">
                            <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-md bg-navy px-1.5 text-[11px] font-bold text-white">
                              {p.id || "•"}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {p.type.replace(/_/g, " ")}
                                </span>
                                {p.manual && <Badge variant="secondary" className="text-[10px]">manual</Badge>}
                                <VerdictBadge verdict={p.verdict} />
                              </div>
                              <p className="mt-0.5">{p.text}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Graded Hit / Miss / No-trigger against the tape after {c.windowEnd} UTC.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {filtered.length > visible.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({filtered.length - visible.length} more)
          </Button>
        </div>
      )}
    </div>
  );
}
