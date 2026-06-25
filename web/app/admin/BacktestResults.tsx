"use client";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { BacktestResult, BacktestPrediction } from "@/lib/engine";
import { clearBacktestResults, setBacktestManualOutcome } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; message: string };

// Per-prediction outcome chip styling — reused verbatim from OpenCallsBrowser's VERDICTS so the
// sandbox table reads with the same Hit / Miss / No-trigger language as the public track record.
const VERDICTS: Record<string, { label: string; cls: string }> = {
  Y: { label: "Hit", cls: "bg-[#dafbe1] text-[#1a7f37]" },
  N: { label: "Miss", cls: "bg-[#ffebe9] text-[#cf222e]" },
  NT: { label: "No-trigger", cls: "bg-tile text-[#57606a]" },
};
// MANUAL / null outcome → amber "needs review" chip (a manual prediction the engine left ungraded).
const NEEDS_REVIEW = { label: "Manual — needs review", cls: "bg-[#fff7e6] text-[#9a6700]" };

// Parse the packed `results` string ("P1=Y P2=N P3=NT") into per-prediction chips. Tolerant of
// missing labels / odd spacing — anything we can't read is shown raw so nothing is silently dropped.
function parseResults(packed: string): { id: string; code: string }[] {
  return (packed || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok, i) => {
      const eq = tok.indexOf("=");
      if (eq === -1) return { id: `P${i + 1}`, code: tok.toUpperCase() };
      return { id: tok.slice(0, eq) || `P${i + 1}`, code: tok.slice(eq + 1).toUpperCase() };
    });
}

function VerdictChip({ code }: { code: string }) {
  const m = VERDICTS[code] ?? { label: code || "—", cls: "bg-tile text-[#57606a]" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>{m.label}</span>;
}

// The outcome chip for a full prediction row in the expanded panel. Maps the stored outcome
// (Y/N/NT) to the Hit/Miss/No-trigger chip; MANUAL or null → the amber "needs review" chip.
function OutcomeChip({ outcome }: { outcome: string | null }) {
  const code = (outcome || "").trim().toUpperCase();
  const m = code && code in VERDICTS ? VERDICTS[code] : NEEDS_REVIEW;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.cls}`}>{m.label}</span>;
}

// Inline manual-grade buttons for a MANUAL prediction. Calls setBacktestManualOutcome and refreshes
// on success so the chip + summary update. Disabled while a grade is in flight.
function ManualControls({
  reportId, predId, onResult,
}: { reportId: string; predId: string; onResult: (r: Result) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (outcome: string | null) =>
    start(async () => {
      try {
        const r = await setBacktestManualOutcome(reportId, predId, outcome);
        onResult(r);
        if (r.ok) router.refresh();
      } catch {
        onResult({ ok: false, message: "Action failed — not authorized?" });
      }
    });
  const BTNS: [string, string | null][] = [["Hit", "Y"], ["Miss", "N"], ["No-trigger", "NT"], ["Clear", null]];
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {BTNS.map(([label, code]) => (
        <button
          key={label}
          type="button"
          disabled={pending}
          onClick={() => set(code)}
          className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink transition-colors hover:bg-tile disabled:opacity-50"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Admin BACKTEST RESULTS (sandbox). List of graded sandbox runs the engine synced into Neon's
// backtest_results — isolated test data that never touches the public ledger or editions. Each row
// expands to its full per-prediction list (backtest_predictions); admins can hand-grade MANUAL ones.
export default function BacktestResults({
  rows, predictions = [],
}: { rows: BacktestResult[]; predictions?: BacktestPrediction[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Group the flat predictions list by report_id (sorted by `sort`) so each expanded row can pull
  // its own predictions without re-filtering the whole array on every render.
  const predsByReport = useMemo(() => {
    const m = new Map<string, BacktestPrediction[]>();
    for (const p of predictions) {
      const arr = m.get(p.reportId);
      if (arr) arr.push(p);
      else m.set(p.reportId, [p]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort - b.sort);
    return m;
  }, [predictions]);

  // Overall hit rate across the graded predictions (sum hits / sum hits+misses), shown in the
  // summary line. No-triggers don't count toward the denominator (consistent with hit_rate).
  const summary = useMemo(() => {
    let hits = 0;
    let denom = 0;
    for (const r of rows) {
      hits += r.hits;
      denom += r.hits + r.misses;
    }
    return { n: rows.length, rate: denom > 0 ? hits / denom : null };
  }, [rows]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () =>
    start(async () => {
      if (!window.confirm("Clear ALL sandbox backtest results? This wipes the admin view and resets the box's sandbox sim trees. The public ledger, editions and track record are untouched. Continue?")) return;
      try {
        const r = await clearBacktestResults();
        setMsg(r);
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, message: "Action failed — not authorized?" });
      }
    });

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        These are <b>isolated sandbox test runs</b> from <b>Run sandbox backtest</b> above — they never
        touch the public ledger, editions, R2 or track record. Use them to sanity-check how the engine
        would have graded a past window. <b>Expand</b> a row to see every prediction; hand-grade any{" "}
        <b>manual</b> ones.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-tile/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No backtest results yet — run a <b>Sandbox backtest</b> above.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <b className="text-navy">{summary.n}</b> graded result{summary.n === 1 ? "" : "s"} ·{" "}
              overall hit rate <b className="text-navy">{pct(summary.rate)}</b>
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={clear}
              className="border-[#cf222e]/40 text-[#cf222e] hover:bg-[#ffebe9]"
            >
              {pending ? "Clearing…" : "Clear backtest results"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2">Instrument</th>
                  <th className="px-3 py-2">View / thesis</th>
                  <th className="px-3 py-2">Conf.</th>
                  <th className="px-3 py-2">Horizon</th>
                  <th className="px-3 py-2">Window end</th>
                  <th className="px-3 py-2">Predictions</th>
                  <th className="px-3 py-2 text-right">Hit rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = expanded.has(r.reportId);
                  const preds = predsByReport.get(r.reportId) ?? [];
                  const panelId = `bt-${r.reportId}`;
                  return (
                    <Fragment key={r.reportId}>
                      <tr
                        className={cn("cursor-pointer align-top transition-colors hover:bg-tile/50", !isOpen && "border-b border-line")}
                        onClick={() => toggle(r.reportId)}
                      >
                        <td className="px-3 py-2.5 w-8 align-middle">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            aria-label={`${isOpen ? "Collapse" : "Expand"} predictions for ${r.instrument || r.ticker || "result"}`}
                            onClick={(e) => { e.stopPropagation(); toggle(r.reportId); }}
                            className="flex items-center text-muted-foreground"
                          >
                            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-ink">{r.instrument || r.ticker || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {[r.ticker, r.assetClass].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[280px] min-w-[180px]">
                          {/* Clamp the (often long) thesis to 2 lines so rows stay compact; the
                              full text shows in the expanded panel below. */}
                          <span className="line-clamp-2 text-ink">{r.view || "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{r.confidence ?? "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.horizon || "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {r.windowEnd || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => {
                            const chips = parseResults(r.results);
                            if (chips.length === 0) return <span className="text-muted-foreground">—</span>;
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {chips.map((p, i) => (
                                  <span key={`${p.id}-${i}`} className="inline-flex items-center gap-1">
                                    <span className="text-[10px] font-semibold text-muted-foreground">{p.id}</span>
                                    <VerdictChip code={p.code} />
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono font-semibold tabular-nums text-navy">{pct(r.hits + r.misses > 0 ? r.hits / (r.hits + r.misses) : null)}</span>
                          <div className="text-[11px] text-muted-foreground">
                            {r.hits}/{r.hits + r.misses}
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr id={panelId} className="border-b border-line">
                          <td className="px-0 py-0" colSpan={8}>
                            <div className="border-t border-line bg-tile/30 px-3 py-3 sm:pl-10">
                              {r.view && (
                                <div className="mb-3">
                                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    View / thesis
                                  </div>
                                  <p className="text-sm text-ink">{r.view}</p>
                                </div>
                              )}
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Individual predictions
                              </div>
                              {preds.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No prediction detail captured for this result.</p>
                              ) : (
                                <ul className="flex flex-col gap-2">
                                  {preds.map((p) => (
                                    <li key={p.predId} className="flex gap-2.5 rounded-lg border border-line bg-white p-2.5 text-sm">
                                      <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-md bg-navy px-1.5 text-[11px] font-bold text-white">
                                        {p.predId || "•"}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            {p.ptype.replace(/_/g, " ") || "prediction"}
                                          </span>
                                          {p.manual && (
                                            <span className="rounded-md bg-tile px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">manual</span>
                                          )}
                                          <OutcomeChip outcome={p.outcome} />
                                        </div>
                                        <p className="mt-0.5 text-ink">{p.ptext}</p>
                                        {p.manual && (
                                          <ManualControls reportId={r.reportId} predId={p.predId} onResult={setMsg} />
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {msg && <span className={`text-sm ${msg.ok ? "text-[#1a7f37]" : "text-[#cf222e]"}`}>{msg.message}</span>}
    </div>
  );
}
