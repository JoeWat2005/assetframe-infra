"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestGeneration } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Asset = { slug: string; instrument: string; ticker: string };
type Result = { ok: boolean; message: string };

// Queue an engine run: "All due" (the engine picks what's due) or hand-picked assets. Optionally
// BACKDATE it (as-of a past time) so the prediction window is already closed — that's how you test
// the ledger immediately instead of waiting ~24h for a live window to close.
export default function GenerateForm({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [allDue, setAllDue] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [asOf, setAsOf] = useState(""); // "" = now; otherwise "YYYY-MM-DDTHH:MM" (UTC)
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((a) => `${a.instrument} ${a.ticker} ${a.slug}`.toLowerCase().includes(needle));
  }, [assets, q]);

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const submit = () =>
    start(async () => {
      try {
        const base = allDue ? { all_due: true as const } : { assets: [...selected] };
        const scope = asOf ? { ...base, as_of: asOf } : base;
        const r = await requestGeneration(scope);
        setMsg(r);
        if (r.ok) {
          setSelected(new Set());
          router.refresh();
        }
      } catch {
        setMsg({ ok: false, message: "Action failed — not authorized?" });
      }
    });

  const canSubmit = !pending && (allDue || selected.size > 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        A run generates each asset&rsquo;s report and <b>registers its predictions</b>. Predictions are
        graded <b>after their window closes</b> (BTC ≈ 24h) — that&rsquo;s when the track record grows.
        To test scoring <b>now</b>, use <b>Backdate</b> below to generate a report whose window has
        already closed, then click <b>Score now</b>.
      </p>

      {/* Mode: all-due vs hand-pick */}
      <div className="inline-flex w-fit overflow-hidden rounded-lg border border-line">
        <Button size="sm" variant={allDue ? "default" : "ghost"} className="rounded-none" disabled={pending} onClick={() => setAllDue(true)}>
          All due
        </Button>
        <Button size="sm" variant={!allDue ? "default" : "ghost"} className="rounded-none border-l border-line" disabled={pending} onClick={() => setAllDue(false)}>
          Pick assets
        </Button>
      </div>

      {allDue ? (
        <p className="text-sm text-muted-foreground">
          The engine will generate every instrument that is <b>due</b> (per its own schedule rules).
        </p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No enabled assets — add or enable one in the <b>Asset universe</b> below.</p>
      ) : (
        <div>
          <Input
            aria-label="Filter assets"
            placeholder="Filter assets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-2 sm:max-w-xs"
          />
          <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-white">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No assets match.</p>
            ) : (
              filtered.map((a) => (
                <label
                  key={a.slug}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-tile/50"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-navy"
                    checked={selected.has(a.slug)}
                    onChange={() => toggle(a.slug)}
                  />
                  <span className="min-w-0 truncate">
                    <b>{a.instrument}</b> <span className="text-muted-foreground">{a.ticker || a.slug}</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{selected.size} selected — picked assets generate together (in parallel).</p>
        </div>
      )}

      {/* Backdate (as-of) — for testing the ledger immediately. */}
      <div className="rounded-lg border border-line bg-tile/30 px-3 py-2.5">
        <label className="block text-xs font-semibold text-navy">Backdate (optional — test the ledger now)</label>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Generate the report as if it were a <b>past</b> UTC date/time, so its prediction window is
          already closed. Then <b>Score now</b> grades it straight into the ledger. Leave blank to run
          for now. Pick a time a few days back (e.g. 3 days ago) for crypto.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            aria-label="Backdate as-of (UTC)"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
          />
          <span className="text-[11px] text-muted-foreground">UTC</span>
          {asOf && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={pending} onClick={() => setAsOf("")}>
              clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!canSubmit} onClick={submit}>
          {pending ? "Queuing…" : asOf ? "Queue backdated run" : "Queue run"}
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
      </div>
    </div>
  );
}
