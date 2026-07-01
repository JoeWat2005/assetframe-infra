"use client";
import { useEffect, useRef, useState } from "react";

// A genuinely LIVE candlestick chart for the hero: the rightmost candle FORMS in real time (its close
// ticks a few times a second), and every ~2s it commits and a fresh candle starts — the whole chart
// scrolling smoothly left as new bars arrive, exactly like a real trading chart. The horizontal scroll
// is driven imperatively per animation frame (no React churn); the candle DATA re-renders ~5x/s.
// Deterministic seed candles on first paint (SSR + first client render match, no hydration flash);
// the live ticking starts after mount and uses Math.random (client only). Decorative, not real quotes.
type C = { o: number; h: number; l: number; c: number };

const VISIBLE = 34;          // fewer, WIDER candles -> bolder
const BAR_MS = 6000;         // ~6s to form one candle — a calm, real-chart pace
const TICK_MS = 240;         // order flow: the forming candle updates a few times a second as "orders" arrive
const W = 1200, H = 460, TOP = 30, BOT = 430;
const slot = W / VISIBLE;
const bodyW = slot * 0.6;
const SPAN = 250;            // price range shown (candle sizes vary a LOT within it -> dramatic)

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedCandles(): { candles: C[]; price: number } {
  const rnd = mulberry32(20260701);
  let prev = 2400;
  const cs: C[] = [];
  for (let i = 0; i < VISIBLE; i++) {
    const vol = 10 + Math.pow(rnd(), 2.6) * 62; // per-candle volatility -> some big, some small
    const c = prev + (rnd() - 0.5) * vol * 2.4;
    cs.push({ o: prev, c, h: Math.max(prev, c) + rnd() * vol * 0.9, l: Math.min(prev, c) - rnd() * vol * 0.9 });
    prev = c;
  }
  return { candles: cs, price: prev };
}
const SEED = seedCandles();

type Snap = { candles: C[]; forming: C; price: number; mid: number };

export default function LiveChart() {
  const [snap, setSnap] = useState<Snap>(() => ({
    candles: SEED.candles.map((c) => ({ ...c })),
    forming: { o: SEED.price, h: SEED.price, l: SEED.price, c: SEED.price },
    price: SEED.price,
    mid: SEED.price,
  }));
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    // A mutable working copy evolved in the loop; PUBLISHED to state (setSnap) on each tick/commit, so
    // render reads state (never a ref value) and the per-frame scroll stays imperative.
    const w = {
      candles: SEED.candles.map((c) => ({ ...c })),
      forming: { o: SEED.price, h: SEED.price, l: SEED.price, c: SEED.price } as C,
      price: SEED.price,
      mid: SEED.price,
      barStart: 0,
      barVol: 26,
    };
    let raf = 0;
    let alive = true;
    const t0 = performance.now();
    w.barStart = t0;
    let lastTick = t0;
    const publish = () =>
      setSnap({ candles: w.candles.map((c) => ({ ...c })), forming: { ...w.forming }, price: w.price, mid: w.mid });
    const step = (t: number) => {
      if (!alive) return;
      const progress = Math.min(1, (t - w.barStart) / BAR_MS);
      // smooth horizontal scroll (imperative — no re-render): the group slides left by one slot per bar
      gRef.current?.setAttribute("transform", `translate(${(-progress * slot).toFixed(2)} 0)`);
      // ease the vertical centre toward the mean close so the chart pans smoothly, never jumps
      const target = w.candles.reduce((a, c) => a + c.c, 0) / w.candles.length;
      w.mid += (target - w.mid) * 0.02;
      if (t - lastTick >= TICK_MS) {
        lastTick = t;
        w.price += (Math.random() - 0.5) * w.barVol + (target - w.price) * 0.006; // per-bar volatility -> varied candles
        w.forming.c = w.price;
        if (w.price > w.forming.h) w.forming.h = w.price;
        if (w.price < w.forming.l) w.forming.l = w.price;
        publish();
      }
      if (progress >= 1) {
        w.candles.push({ ...w.forming });
        if (w.candles.length > VISIBLE) w.candles.shift();
        w.forming = { o: w.price, h: w.price, l: w.price, c: w.price };
        w.barVol = 10 + Math.pow(Math.random(), 2.6) * 62; // next candle's volatility (some big, some small)
        w.barStart = t;
        gRef.current?.setAttribute("transform", "translate(0 0)");
        publish();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const { candles, forming, price, mid } = snap;
  const y = (p: number) => TOP + (1 - (p - (mid - SPAN)) / (2 * SPAN)) * (BOT - TOP);
  const all = [...candles, forming]; // forming sits at the far right and scrolls in
  const py = y(price);

  return (
    <svg className="h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <g ref={gRef}>
        {all.map((c, i) => {
          const x = i * slot + slot / 2;
          const up = c.c >= c.o;
          const color = up ? "#22c069" : "#ef5350";
          const top = Math.min(y(c.o), y(c.c));
          const h = Math.max(1.5, Math.abs(y(c.o) - y(c.c)));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} rx="1" />
            </g>
          );
        })}
      </g>
      {/* live current-price line + dot at the right edge (outside the scrolling group, so it stays put) */}
      <line x1="0" x2={W} y1={py} y2={py} stroke="#7fb0ff" strokeOpacity="0.35" strokeDasharray="4 6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <circle cx={W - slot / 2} cy={py} r="3.5" fill="#7fb0ff" />
    </svg>
  );
}
