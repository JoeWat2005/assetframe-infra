"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestGeneration, sendEngineCommand } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Asset = { slug: string; instrument: string; ticker: string };
type Result = { ok: boolean; message: string };

// Two panels, selected by `mode`:
//   "queue"    — a MANUAL OVERRIDE run (all-due or hand-picked). The daily/weekly/monthly schedule
//                normally drives generation; this re-runs one asset now (e.g. after a brief edit).
//   "backtest" — the isolated SANDBOX backtest (separate ledger, never published). Seeding/testing
//                the track record is done here, not via a backdated live run.
export default function GenerateForm({ assets, mode = "queue" }: { assets: Asset[]; mode?: "queue" | "backtest" }) {
  const router = useRouter();
  const [allDue, setAllDue] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  // SANDBOX BACKTEST — fully isolated test, its own state (separate selection, REQUIRED as-of).
  const [btSelected, setBtSelected] = useState<Set<string>>(new Set());
  const [btQ, setBtQ] = useState("");
  const [btAsOf, setBtAsOf] = useState(""); // REQUIRED "YYYY-MM-DDTHH:MM" (UTC) — must be a closed window
  const [btDays, setBtDays] = useState(1); // how many days to simulate (1 = just the as-of day; up to 90)
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
        const r = await sendEngineCommand("run_backtest", { assets: [...btSelected], as_of: btAsOf, days: btDays });
        setBtMsg(r);
        if (r.ok) {
          setBtSelected(new Set());
          setBtAsOf("");
          setBtDays(1);
          router.refresh();
        }
      } catch {
        setBtMsg({ ok: false, message: "Action failed — not authorized?" });
      }
    });

  const canBacktest = !btPending && btSelected.size > 0 && btAsOf.trim().length > 0;

  // === QUEUE (manual override) ===
  if (mode === "queue") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Manual override — the daily/weekly/monthly <b>schedule</b> normally drives generation. Use this to
          (re)generate <b>all due</b> assets or a specific one <b>now</b> (e.g. after editing a brief). New
          editions land hidden for your approval.
        </p>

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
            The engine will generate every instrument that is <b>due</b> (per its cadence rules).
          </p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enabled assets — add or enable one in the <b>Asset universe</b>.</p>
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

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!canSubmit} onClick={submit}>
            {pending ? "Queuing…" : "Queue run"}
          </Button>
          {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
        </div>
      </div>
    );
  }

  // === SANDBOX BACKTEST — isolated test (separate ledger, no publish). ===
  return (
    <div className="flex flex-col gap-3">
      <p className="mt-1.5 text-[11px] text-[#9a6700]/90">
        Generates the picked assets <b>backdated</b> to an already-closed window and scores them into an
        <b> isolated sandbox ledger</b>. Nothing is published — purely a test run; results show on the right.
      </p>

      {assets.length === 0 ? (
        <p className="mt-1 text-sm text-[#9a6700]">No enabled assets — add or enable one in the <b>Asset universe</b>.</p>
      ) : (
        <div>
          <Input
            aria-label="Filter assets to backtest"
            placeholder="Filter assets…"
            value={btQ}
            onChange={(e) => setBtQ(e.target.value)}
            className="mb-2 border-[#bf8700]/40 bg-white sm:max-w-xs"
          />
          <div className="max-h-56 overflow-y-auto rounded-xl border border-[#bf8700]/40 bg-white">
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

      <div>
        <label htmlFor="bt-asof" className="mb-1 block text-[11px] font-semibold text-[#9a6700]">
          Most recent day to simulate (UTC) — required
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
          The <b>newest</b> day — &ldquo;Days&rdquo; counts <b>backward</b> from here. Pick <b>~2–3 days ago</b>:
          the prediction window must have <b>already closed</b> to score.
        </p>
      </div>

      <div>
        <label htmlFor="bt-days" className="mb-1 block text-[11px] font-semibold text-[#9a6700]">
          Days to simulate
        </label>
        <input
          id="bt-days"
          type="number"
          min={1}
          max={90}
          aria-label="Days to simulate"
          value={btDays}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            setBtDays(Number.isFinite(n) ? Math.max(1, Math.min(90, n)) : 1);
          }}
          className="h-9 w-24 rounded-lg border border-[#bf8700]/40 bg-white px-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-[#9a6700]/90">
          Counts <b>backward</b> from the day above: <b>1</b> = just that day; <b>7</b> = a week, <b>30</b> = a
          month (up to 90). Each day generates a full report — more days = more API calls + minutes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
    </div>
  );
}
