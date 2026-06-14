// Decorative market-tape backdrop for the hero: a deterministic candlestick chart
// (no Math.random, so it's SSR-safe) that drifts sideways. Domain-relevant, not a
// fake screenshot — this is the kind of chart the product actually publishes.
const CLOSES = [
  3020, 3105, 2980, 2890, 2760, 2810, 2650, 2540, 2600, 2470, 2380, 2440, 2300, 2210,
  2280, 2150, 2060, 2120, 1990, 1900, 1960, 1840, 1900, 1820, 1760, 1820, 1700, 1640,
  1700, 1620, 1680, 1600, 1660, 1720, 1660, 1740, 1690, 1760, 1700, 1640, 1700, 1660,
  1722, 1684, 1742, 1690, 1660, 1720,
];

const W = 1200, H = 460, TOP = 40, BOT = 410;
const N = CLOSES.length;
const minP = Math.min(...CLOSES) * 0.985;
const maxP = Math.max(...CLOSES) * 1.012;
const y = (p: number) => TOP + (1 - (p - minP) / (maxP - minP)) * (BOT - TOP);
const slot = W / N;
const bodyW = slot * 0.5;
const wick = (maxP - minP) * 0.014;

function sma(period: number): (number | null)[] {
  return CLOSES.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let k = 0; k < period; k++) s += CLOSES[i - k];
    return s / period;
  });
}
const sma8 = sma(8);
const sma21 = sma(21);
const linePts = (arr: (number | null)[]) =>
  arr.map((v, i) => (v == null ? null : `${i * slot + slot / 2},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");

function ChartPanel() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="h-full w-1/2 shrink-0">
      {/* faint reference levels */}
      {[0.28, 0.5, 0.72].map((f) => (
        <line key={f} x1="0" x2={W} y1={TOP + f * (BOT - TOP)} y2={TOP + f * (BOT - TOP)}
          stroke="#7fb0ff" strokeOpacity="0.12" strokeDasharray="5 7" strokeWidth="1" />
      ))}
      {/* candles */}
      {CLOSES.map((c, i) => {
        const o = i === 0 ? c : CLOSES[i - 1];
        const up = c >= o;
        const cx = i * slot + slot / 2;
        const top = Math.min(y(o), y(c));
        const h = Math.max(2, Math.abs(y(o) - y(c)));
        const color = up ? "#22c069" : "#ef5350";
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(Math.max(o, c) + wick)} y2={y(Math.min(o, c) - wick)} stroke={color} strokeWidth="1.4" />
            <rect x={cx - bodyW / 2} y={top} width={bodyW} height={h} fill={color} rx="1" />
          </g>
        );
      })}
      <polyline points={linePts(sma21)} fill="none" stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="2.5" />
      <polyline points={linePts(sma8)} fill="none" stroke="#7fb0ff" strokeOpacity="0.8" strokeWidth="2.5" />
    </svg>
  );
}

export default function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* accent glow */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(58rem 30rem at 82% 8%, rgba(127,176,255,0.16), transparent 62%)" }}
      />
      {/* terminal grid */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* drifting candlesticks */}
      <div className="af-drift absolute inset-0 flex w-[200%] opacity-[0.5]">
        <ChartPanel />
        <ChartPanel />
      </div>
      {/* readability scrims (keep the left where the copy sits dark) */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(11,37,69,0.97) 0%, rgba(11,37,69,0.78) 42%, rgba(11,37,69,0.32) 100%)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: "linear-gradient(to top, #0b2545, transparent)" }} />
    </div>
  );
}
