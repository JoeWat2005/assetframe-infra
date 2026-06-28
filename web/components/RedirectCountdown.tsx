"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Animated auto-redirect for the 404 page: a GSAP-driven progress bar drains over
// `seconds`, then routes to `to`. A JS safety timer guarantees the redirect even if
// GSAP fails to load, and reduced-motion users get the countdown without the animation.
// WCAG 2.2.1 (Timing Adjustable): the user can cancel the timed redirect with "Stay on this
// page", and can always jump immediately with "Go now".
export default function RedirectCountdown({ seconds = 5, to = "/" }: { seconds?: number; to?: string }) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(seconds);
  const [stopped, setStopped] = useState(false);
  // Hold the live timers/tween so the cancel button can turn the redirect off (the effect
  // owns creating them; the button just needs to be able to clear them).
  const timers = useRef<{ interval?: number; safety?: number; tween?: { kill: () => void } }>({});

  useEffect(() => {
    if (stopped) return; // cancelled — no timers, the user stays put
    let cancelled = false;
    let done = false;
    const go = () => {
      if (cancelled || done) return;
      done = true;
      router.push(to);
    };

    const interval = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const safety = window.setTimeout(go, seconds * 1000 + 150); // never strand the user
    timers.current.interval = interval;
    timers.current.safety = safety;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && barRef.current) {
      import("gsap")
        .then(({ gsap }) => {
          if (cancelled || !barRef.current) return;
          timers.current.tween = gsap.fromTo(
            barRef.current,
            { scaleX: 1 },
            { scaleX: 0, duration: seconds, ease: "none", transformOrigin: "left center", onComplete: go }
          );
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(safety);
      timers.current.tween?.kill();
    };
  }, [router, seconds, to, stopped]);

  // Cancel the timed auto-redirect but keep the manual "Go now" accelerator.
  const stop = () => {
    window.clearInterval(timers.current.interval);
    window.clearTimeout(timers.current.safety);
    timers.current.tween?.kill();
    setStopped(true);
  };

  return (
    <div className="mx-auto mt-9 max-w-sm" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm text-[#aebfd6]">
        <span>{stopped ? "Auto-redirect off — take your time." : "Taking you home…"}</span>
        {!stopped && <span className="font-mono tabular-nums">{left}s</span>}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          ref={barRef}
          className="h-full rounded-full bg-[#7fb0ff]"
          style={{ transform: "scaleX(1)", transformOrigin: "left center" }}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => router.push(to)}
          className="text-xs font-semibold text-[#7fb0ff] underline underline-offset-2 hover:text-white"
        >
          Go now
        </button>
        {!stopped && (
          <button
            type="button"
            onClick={stop}
            className="text-xs font-semibold text-[#aebfd6] underline underline-offset-2 hover:text-white"
          >
            Stay on this page
          </button>
        )}
      </div>
    </div>
  );
}
