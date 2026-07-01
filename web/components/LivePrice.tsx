"use client";
import { useEffect, useState } from "react";

// A live-quote panel for the hero: a few instruments whose prices tick every second — a random walk
// with mild mean-reversion, green/red on each move. Deterministic seed values on first render (so SSR
// and the first client render match — no hydration mismatch); the ticking starts after mount.
// DECORATIVE flavour, not real market data (the site never fabricates quotes in actual reports).
type Row = { sym: string; price: number; prev: number; open: number };
const SEED: { sym: string; base: number; dp: number; vol: number }[] = [
  { sym: "BTC/USD", base: 61240.0, dp: 1, vol: 24 },
  { sym: "XAU/USD", base: 2388.5, dp: 1, vol: 1.0 },
  { sym: "EUR/USD", base: 1.0842, dp: 4, vol: 0.0007 },
  { sym: "AAPL", base: 214.3, dp: 2, vol: 0.16 },
];

const fmt = (n: number, dp: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function LivePrice() {
  const [rows, setRows] = useState<Row[]>(() =>
    SEED.map((s) => ({ sym: s.sym, price: s.base, prev: s.base, open: s.base })));

  useEffect(() => {
    // Tick once a second (deferred in a timer callback, not synchronously in the effect).
    const tick = () =>
      setRows((rs) =>
        rs.map((r, i) => {
          const s = SEED[i];
          const drift = (Math.random() - 0.5) * 2 * s.vol;
          const pull = (s.base - r.price) * 0.03; // mild mean-reversion so it wanders, never runs away
          return { ...r, prev: r.price, price: r.price + drift + pull };
        })
      );
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-64 rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Live markets</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-[#7fe0a0]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#22c069]" />
          LIVE
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((r, i) => {
          const dp = SEED[i].dp;
          const up = r.price >= r.prev;
          const pct = ((r.price - r.open) / r.open) * 100;
          const pctUp = pct >= 0;
          return (
            <div key={r.sym} className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-2 py-1.5 font-mono text-sm first:border-t-0">
              <span className="font-semibold text-white/80">{r.sym}</span>
              <span className="flex items-baseline gap-2">
                <span className={`tabular-nums transition-colors duration-500 ${up ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                  {fmt(r.price, dp)}
                </span>
                <span className={`w-[52px] text-right text-xs tabular-nums ${pctUp ? "text-[#4ade80]/80" : "text-[#f87171]/80"}`}>
                  {pctUp ? "+" : ""}{pct.toFixed(2)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
