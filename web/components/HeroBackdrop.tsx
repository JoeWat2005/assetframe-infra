// Decorative market backdrop for the hero. Built for depth + life without being tacky:
//   - a soft filled AREA chart drifting slowly in the back (parallax depth),
//   - crisp candlesticks + moving averages drifting in front,
//   - a gently BREATHING accent glow, and a subtle diagonal SHEEN sweep.
// The price series is a seeded random WALK (fixed-seed PRNG -> server and client render identically,
// no hydration mismatch, but it reads as an organic series). It's DETRENDED so the last close returns
// to the first, and each layer is TILED twice across a 2x-wide SVG so the af-drift loop is seamless.
// preserveAspectRatio="none" fills the hero edge-to-edge (no crop); non-scaling strokes stay crisp.
const N = 64;
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _rnd = mulberry32(20260701);
const _raw: number[] = [0];
for (let i = 1; i < N; i++) _raw.push(_raw[i - 1] + (_rnd() - 0.5) * 2.4);
const _drift = _raw[N - 1] / (N - 1);
const _walk = _raw.map((v, i) => v - _drift * i); // close the loop: _walk[0] === _walk[N-1] === 0
const _lo = Math.min(..._walk);
const _hi = Math.max(..._walk);
const CLOSES = _walk.map((v) => Math.round(1900 + ((v - _lo) / (_hi - _lo || 1)) * 1300));

const W = 1400, H = 460, TOP = 36, BOT = 424; // one tile is W wide; the SVG viewBox is 2*W (tiled twice)
const minP = Math.min(...CLOSES) * 0.985;
const maxP = Math.max(...CLOSES) * 1.012;
const y = (p: number) => TOP + (1 - (p - minP) / (maxP - minP)) * (BOT - TOP);
const slot = W / N;
const bodyW = slot * 0.52;
const wick = (maxP - minP) * 0.012;

function sma(period: number, i: number): number {
  let s = 0;
  for (let k = 0; k < period; k++) s += CLOSES[(i - k + N) % N];
  return s / period;
}
const TILED = Array.from({ length: 2 * N }, (_, i) => i);
const cx = (i: number) => i * slot + slot / 2;
const smaPts = (period: number) => TILED.map((i) => `${cx(i)},${y(sma(period, i % N)).toFixed(1)}`).join(" ");
const SMA21 = smaPts(21);
const SMA8 = smaPts(8);

const svgProps = { viewBox: `0 0 ${2 * W} ${H}`, preserveAspectRatio: "none" as const };

function CandleLayer() {
  return (
    <svg className="af-drift h-full w-[200%]" {...svgProps}>
      {[0.26, 0.5, 0.74].map((f) => (
        <line key={f} x1="0" x2={2 * W} y1={TOP + f * (BOT - TOP)} y2={TOP + f * (BOT - TOP)}
          stroke="#7fb0ff" strokeOpacity="0.1" strokeDasharray="6 9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      {TILED.map((i) => {
        const c = CLOSES[i % N];
        const o = CLOSES[(i - 1 + N) % N];
        const up = c >= o;
        const x = cx(i);
        const top = Math.min(y(o), y(c));
        const h = Math.max(2, Math.abs(y(o) - y(c)));
        const color = up ? "#22c069" : "#ef5350";
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(Math.max(o, c) + wick)} y2={y(Math.min(o, c) - wick)}
              stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
            <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} rx="1" />
          </g>
        );
      })}
      <polyline points={SMA21} fill="none" stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <polyline points={SMA8} fill="none" stroke="#7fb0ff" strokeOpacity="0.85" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* breathing accent glow */}
      <div
        className="af-breathe absolute inset-0"
        style={{ background: "radial-gradient(56rem 30rem at 80% 6%, rgba(127,176,255,0.20), transparent 60%)" }}
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
      {/* candles + moving averages, drifting */}
      <div className="absolute inset-0 opacity-[0.55]"><CandleLayer /></div>
      {/* subtle diagonal sheen sweeping across */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="af-sheen absolute inset-y-0 left-0 w-1/3"
          style={{ background: "linear-gradient(100deg, transparent, rgba(173,200,255,0.12) 50%, transparent)" }}
        />
      </div>
      {/* readability scrims — keep the left (copy) dark, let the chart breathe on the right */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(11,37,69,0.94) 0%, rgba(11,37,69,0.66) 40%, rgba(11,37,69,0.18) 100%)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: "linear-gradient(to top, #0b2545, transparent)" }} />
    </div>
  );
}
