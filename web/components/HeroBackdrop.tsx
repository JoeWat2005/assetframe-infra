import LiveChart from "@/components/LiveChart";

// Hero backdrop: a genuinely LIVE candlestick chart (new bars form on the right and scroll left in
// real time — see LiveChart) over a breathing accent glow, a terminal grid, a subtle sheen sweep, and
// readability scrims that keep the left (where the copy sits) dark.
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
      {/* the live chart — its RIGHT edge (the forming candle + live price dot) sits ~midway between
          where the hero copy ends and the right edge of the screen; history streams LEFT and runs off
          the left edge. */}
      <div className="absolute inset-y-0 right-[26%] -left-[16%] opacity-[0.72]">
        <LiveChart />
      </div>
      {/* subtle diagonal sheen sweeping across */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="af-sheen absolute inset-y-0 left-0 w-1/3"
          style={{ background: "linear-gradient(100deg, transparent, rgba(173,200,255,0.10) 50%, transparent)" }}
        />
      </div>
      {/* readability scrim — keeps the copy (left) dark, lightens where the live candles sit (~centre) */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(11,37,69,0.95) 0%, rgba(11,37,69,0.84) 30%, rgba(11,37,69,0.52) 45%, rgba(11,37,69,0.2) 57%, rgba(11,37,69,0.12) 72%, rgba(11,37,69,0.12) 100%)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: "linear-gradient(to top, #0b2545, transparent)" }} />
    </div>
  );
}
