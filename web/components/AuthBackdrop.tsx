// Auth-panel backdrop: a finance "market tape" — a vertical column of ticker rows
// drifting upward. Deterministic (SSR-safe), CSS-animated, reduced-motion safe.
const ROWS = [
  { sym: "ETH-USD", px: "1,684.20", chg: "+0.42%", up: true },
  { sym: "AAPL", px: "214.30", chg: "-1.18%", up: false },
  { sym: "SOL-USD", px: "146.82", chg: "+2.10%", up: true },
  { sym: "BTC-USD", px: "61,240", chg: "-0.34%", up: false },
  { sym: "GC=F", px: "2,388.5", chg: "+0.21%", up: true },
  { sym: "CL=F", px: "78.94", chg: "-0.88%", up: false },
  { sym: "EUR/USD", px: "1.0842", chg: "+0.06%", up: true },
  { sym: "NQ=F", px: "19,210", chg: "+0.54%", up: true },
  { sym: "TSLA", px: "242.11", chg: "-2.04%", up: false },
  { sym: "GBP/USD", px: "1.2731", chg: "+0.12%", up: true },
  { sym: "ES=F", px: "5,438.0", chg: "+0.31%", up: true },
  { sym: "NVDA", px: "120.45", chg: "-1.55%", up: false },
];

// Each column repeats the rows enough times that ONE column is taller than any realistic auth-panel
// height — otherwise, at the loop extreme the translateY(-50%) exposes empty space below the content
// (the "the stocks disappear / it ends" bug). mb-3 on EVERY row (not a parent `gap`) keeps the
// repeating unit exactly row+gap, so two stacked columns loop seamlessly under translateY(-50%).
const TAPE = [...ROWS, ...ROWS, ...ROWS];

function TapeColumn() {
  return (
    <div className="flex flex-col">
      {TAPE.map((r, i) => (
        <div
          key={i}
          className="mb-3 flex items-center justify-between gap-5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm"
        >
          <span className="font-semibold text-white/85">{r.sym}</span>
          <span className="text-white/65">{r.px}</span>
          <span className={r.up ? "text-[#22c069]" : "text-[#ef5350]"}>{r.chg}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuthBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(155deg, #0b2545 0%, #102f56 55%, #0a2140 100%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(42rem 26rem at 18% 4%, rgba(127,176,255,0.16), transparent 60%)" }} />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute inset-y-0 right-6 w-60 overflow-hidden opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
        <div className="af-tape flex flex-col">
          <TapeColumn />
          <TapeColumn />
        </div>
      </div>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(11,37,69,0.96) 0%, rgba(11,37,69,0.72) 46%, rgba(11,37,69,0.28) 100%)" }}
      />
    </div>
  );
}
