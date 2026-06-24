"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestGeneration, sendEngineCommand } from "./actions";
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

  // SANDBOX BACKTEST — fully isolated test. Its own state so it can never share a control with the
  // real Queue run above: a separate asset selection, a REQUIRED as-of, its own message + transition.
  const [btSelected, setBtSelected] = useState<Set<string>>(new Set());
  const [btQ, setBtQ] = useState("");
  const [btAsOf, setBtAsOf] = useState(""); // REQUIRED "YYYY-MM-DDTHH:MM" (UTC) — must be a closed window
  const [btMsg, setBtMsg] = useState<Result | null>(null);
  const [btPending, btStart] = useTransition();

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

  // --- Sandbox backtest helpers (mirror the picker above, but write to the sandbox state) ---
  const btFiltered = useMemo(() => {
    const needle = btQ.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((a) => `${a.instrument} ${a.ticker} ${a.slug}`.toLowerCase().includes(needle));
  }, [assets, btQ]);

  const btToggle = (slug: string) =>
    setBtSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const btSubmit = () =>
    btStart(async () => {
      try {
        const r = await sendEngineCommand("run_backtest", { assets: [...btSelected], as_of: btAsOf });
        setBtMsg(r);
        if (r.ok) {
          setBtSelected(new Set());
          setBtAsOf("");
          router.refresh();
        }
      } catch {
        setBtMsg({ ok: false, message: "Action failed — not authorized?" });
      }
    });

  const canBacktest = !btPending && btSelected.size > 0 && btAsOf.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        A run generates each asset&rsquo;s report and <b>registers its predictions</b>. Predictions are
        graded <b>after their window closes</b> (BTC ≈ 24h) — that&rsquo;s when the track record grows.
        To test scoring <b>now</b>, use <b>Backdate</b> below to generate a report whose window has
        already closed, then click <b>Score now</b>.
      </p>

      {/* Mode: all-due vs hand-pick. Secondary weight (vs the solid primary CTA) so the segmented
          control reads as a selector, not a competing call-to-action. */}
      <div className="inline-flex w-fit overflow-hidden rounded-lg border border-line">
        <Button size="sm" variant={allDue ? "secondary" : "ghost"} className="rounded-none" disabled={pending} onClick={() => setAllDue(true)}>
          All due
        </Button>
        <Button size="sm" variant={!allDue ? "secondary" : "ghost"} className="rounded-none border-l border-line" disabled={pending} onClick={() => setAllDue(false)}>
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

      {/* Primary action — the everyday flow. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!canSubmit} onClick={submit}>
          {pending ? "Queuing…" : asOf ? "Queue backdated run" : "Queue run"}
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
      </div>

      {/* Backdate (as-of) — launch-week seeding tool, tucked behind a collapsed disclosure so it
          never competes with the everyday flow. Collapsed = empty as-of = a normal "now" run.
          onToggle resets asOf to "" whenever the panel is closed. */}
      <details
        className="rounded-lg border border-line bg-tile/30 px-3 py-2.5"
        onToggle={(e) => {
          if (!(e.currentTarget as HTMLDetailsElement).open) setAsOf("");
        }}
      >
        <summary className="cursor-pointer text-xs font-semibold text-navy">
          Seed / test the track record (advanced)
        </summary>
        <p className="mb-2 mt-2 text-[11px] text-muted-foreground">
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
      </details>

      {/* === SANDBOX BACKTEST — deliberately styled NOTHING like the Queue run above (amber tint +
          dashed border) so it can never be mistaken for a live run. It enqueues a `run_backtest` box
          command: the engine generates the picked assets backdated to as-of, scores into a SEPARATE
          sandbox ledger, and never publishes. Zero production impact. === */}
      <div className="rounded-xl border-2 border-dashed border-[#bf8700]/50 bg-[#fff7e6]/60 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#fff0c2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9a6700]">
            Sandbox
          </span>
          <h3 className="text-sm font-bold text-[#9a6700]">
            Sandbox backtest — test only (no publish, separate ledger)
          </h3>
        </div>
        <p className="mt-1.5 text-[11px] text-[#9a6700]/90">
          Generates the picked assets <b>backdated</b> to an already-closed window and scores them into an
          <b> isolated sandbox ledger</b>. Nothing is published — purely a test run.
        </p>

        {assets.length === 0 ? (
          <p className="mt-3 text-sm text-[#9a6700]">No enabled assets — add or enable one in the <b>Asset universe</b> below.</p>
        ) : (
          <div className="mt-3">
            <Input
              aria-label="Filter assets to backtest"
              placeholder="Filter assets…"
              value={btQ}
              onChange={(e) => setBtQ(e.target.value)}
              className="mb-2 border-[#bf8700]/40 bg-white sm:max-w-xs"
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#bf8700]/40 bg-white">
              {btFiltered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No assets match.</p>
              ) : (
                btFiltered.map((a) => (
                  <label
                    key={a.slug}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-[#fff7e6]/60"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[#bf8700]"
                      checked={btSelected.has(a.slug)}
                      onChange={() => btToggle(a.slug)}
                    />
                    <span className="min-w-0 truncate">
                      <b>{a.instrument}</b> <span className="text-muted-foreground">{a.ticker || a.slug}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-[#9a6700]/90">{btSelected.size} selected to backtest.</p>
          </div>
        )}

        {/* REQUIRED as-of — a backtest needs a window that has already closed. */}
        <div className="mt-3">
          <label htmlFor="bt-asof" className="mb-1 block text-[11px] font-semibold text-[#9a6700]">
            As-of date/time (UTC) — required
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="bt-asof"
              type="datetime-local"
              aria-label="Sandbox backtest as-of (UTC)"
              value={btAsOf}
              onChange={(e) => setBtAsOf(e.target.value)}
              className="h-9 rounded-lg border border-[#bf8700]/40 bg-white px-2 text-sm"
            />
            <span className="text-[11px] text-[#9a6700]/90">UTC</span>
          </div>
          <p className="mt-1 text-[11px] text-[#9a6700]/90">
            Pick a time a few days ago — the prediction window must have <b>already closed</b> for a
            backtest to score.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={!canBacktest}
            onClick={btSubmit}
            className="bg-[#bf8700] text-white hover:bg-[#9a6700]"
          >
            {btPending ? "Queuing…" : "Run sandbox backtest"}
          </Button>
          {btMsg && <span className={`text-sm ${btMsg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{btMsg.message}</span>}
        </div>

        <p className="mt-2 text-[11px] text-[#9a6700]/90">
          Results appear in <b>Recent engine runs</b> (marked as a backtest) and touch nothing public — the
          live ledger, editions, R2 and track record are untouched.
        </p>
      </div>
    </div>
  );
}
