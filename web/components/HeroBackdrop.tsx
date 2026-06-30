// Decorative market-tape backdrop for the hero: a candlestick chart that drifts sideways FOREVER and
// fills the whole hero edge-to-edge. The price series is a seeded random WALK (fixed-seed PRNG -> the
// server and client render identically, no hydration mismatch, but it reads as an organic series, not
// an obvious wave), DETRENDED so the last close returns to the first. It's rendered ONCE then TILED
// twice across a 2x-wide SVG; the af-drift animation slides it by exactly one tile, so the loop is
// seamless. preserveAspectRatio="none" makes the viewBox fill the element exactly (no crop -> no
// "cutoff"); strokes use non-scaling-stroke so the non-uniform fill doesn't distort line weights.
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

// Cyclic SMA (wraps the series) so the moving-average lines stay continuous across the tile seam.
function sma(period: number, i: number): number {
  let s = 0;
  for (let k = 0; k < period; k++) s += CLOSES[(i - k + N) % N];
  return s / period;
}
// 2*N points (the series tiled twice) so the polyline spans the full 2*W viewBox with no restart.
const TILED = Array.from({ length: 2 * N }, (_, i) => i);
const linePts = (period: number) =>
  TILED.map((i) => `${i * slot + slot / 2},${y(sma(period, i % N)).toFixed(1)}`).join(" ");

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
      {/* drifting candlesticks — one 2x-wide SVG that fills the hero (no crop) and tiles seamlessly */}
      <div className="absolute inset-0 opacity-[0.55]">
        <svg
          className="af-drift h-full w-[200%]"
          viewBox={`0 0 ${2 * W} ${H}`}
          preserveAspectRatio="none"
        >
          {/* faint reference levels (span both tiles) */}
          {[0.26, 0.5, 0.74].map((f) => (
            <line key={f} x1="0" x2={2 * W} y1={TOP + f * (BOT - TOP)} y2={TOP + f * (BOT - TOP)}
              stroke="#7fb0ff" strokeOpacity="0.1" strokeDasharray="6 9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {/* candles — tiled twice; each open wraps cyclically so the tile seam is continuous */}
          {TILED.map((i) => {
            const c = CLOSES[i % N];
            const o = CLOSES[(i - 1 + N) % N];
            const up = c >= o;
            const cx = i * slot + slot / 2;
            const top = Math.min(y(o), y(c));
            const h = Math.max(2, Math.abs(y(o) - y(c)));
            const color = up ? "#22c069" : "#ef5350";
            return (
              <g key={i}>
                <line x1={cx} x2={cx} y1={y(Math.max(o, c) + wick)} y2={y(Math.min(o, c) - wick)}
                  stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <rect x={cx - bodyW / 2} y={top} width={bodyW} height={h} fill={color} rx="1" />
              </g>
            );
          })}
          <polyline points={linePts(21)} fill="none" stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <polyline points={linePts(8)} fill="none" stroke="#7fb0ff" strokeOpacity="0.85" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {/* readability scrims — keep the left (where the copy sits) dark, let the chart breathe on the right */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(11,37,69,0.94) 0%, rgba(11,37,69,0.66) 40%, rgba(11,37,69,0.18) 100%)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: "linear-gradient(to top, #0b2545, transparent)" }} />
    </div>
  );
}
