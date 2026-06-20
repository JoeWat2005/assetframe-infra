"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestGeneration } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Asset = { slug: string; instrument: string; ticker: string };
type Result = { ok: boolean; message: string };

// Queue an engine run: either "All due" (the engine decides which instruments are due) or a
// hand-picked set of known asset slugs. Mirrors AdminActions' useTransition + router.refresh()
// pattern, with an inline result message instead of a separate toast lib.
export default function GenerateForm({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [allDue, setAllDue] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
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
        const scope = allDue ? { all_due: true as const } : { assets: [...selected] };
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

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!canSubmit} onClick={submit}>
          {pending ? "Queuing…" : "Queue run"}
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
      </div>
    </div>
  );
}
