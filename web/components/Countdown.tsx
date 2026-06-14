"use client";
import { useEffect, useState } from "react";
import { SITE } from "@/site.config";
import { cn } from "@/lib/utils";

// Next generation time, in UTC, derived from the configured cadence. Pure so it's testable.
function nextTarget(now: Date): Date {
  const { cadence, hourUTC, weekdayUTC } = SITE.publish;
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUTC, 0, 0, 0));
  if (cadence === "weekly") {
    while (t.getUTCDay() !== weekdayUTC || t.getTime() <= now.getTime()) {
      t.setUTCDate(t.getUTCDate() + 1);
    }
  } else if (t.getTime() <= now.getTime()) {
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return t;
}

function split(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return {
    Days: Math.floor(s / 86400),
    Hours: Math.floor((s % 86400) / 3600),
    Mins: Math.floor((s % 3600) / 60),
    Secs: s % 60,
  };
}

export default function Countdown({ tone = "dark", showLabel = true }: { tone?: "dark" | "light"; showLabel?: boolean }) {
  // null until mounted so server and client render the same markup (no hydration mismatch).
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setMs(nextTarget(new Date(now)).getTime() - now);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const parts = ms === null ? null : split(ms);
  const tiles: ["Days" | "Hours" | "Mins" | "Secs"][] = [["Days"], ["Hours"], ["Mins"], ["Secs"]];
  const light = tone === "light";

  return (
    <div>
      <div className="flex gap-2 sm:gap-3">
        {tiles.map(([label]) => (
          <div
            key={label}
            className={cn(
              "flex min-w-[54px] flex-col items-center rounded-xl border px-3 py-2 sm:min-w-[68px]",
              light ? "border-line bg-white text-navy" : "border-white/15 bg-white/5 text-white backdrop-blur"
            )}
          >
            <span className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
              {parts === null ? "––" : String(parts[label]).padStart(2, "0")}
            </span>
            <span className={cn("mt-0.5 text-[11px] uppercase tracking-wide", light ? "text-muted-foreground" : "text-white/60")}>
              {label}
            </span>
          </div>
        ))}
      </div>
      {showLabel && (
        <p className={cn("mt-2 text-xs", light ? "text-muted-foreground" : "text-white/60")}>{SITE.publish.label}</p>
      )}
    </div>
  );
}
