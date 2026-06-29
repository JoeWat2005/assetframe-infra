"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Button } from "@/components/ui/button";

const KEY = "af-cookie-consent";
// Defaults to the AssetFrame GA4 property in production so analytics works without
// extra Vercel config (the Measurement ID is public — it ships in the page anyway).
// Override anytime with NEXT_PUBLIC_GA_ID. Undefined in dev so localhost isn't tracked.
const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ||
  (process.env.NODE_ENV === "production" ? "G-QK5EM4V2LJ" : undefined);

// Loads Google Analytics ONLY after the visitor accepts (GA sets non-essential
// cookies, so under UK/EU rules it must be consented to first). The banner is shown
// only when a GA id is configured — Clerk's auth cookies are strictly necessary and
// need no consent, so with no GA there's nothing to ask about.
// In-memory fallback so a consent choice still sticks for the session when localStorage is
// blocked (private mode) — mirrors the original, where decide() updated React state directly.
let memConsent: "granted" | "denied" | null = null;
function readConsent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    /* storage blocked — fall through to the in-memory value */
  }
  return memConsent;
}
function subscribeConsent(cb: () => void) {
  window.addEventListener("af-consent", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("af-consent", cb);
    window.removeEventListener("storage", cb);
  };
}

export default function ConsentAnalytics() {
  // mounted: false during SSR + the first client (hydration) render, true after — with no effect
  // and no setState, so there's no hydration flash and no react-hooks/set-state-in-effect.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  // consent: read straight from localStorage; re-reads when decide() or another tab changes it.
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);

  const decide = (v: "granted" | "denied") => {
    memConsent = v;
    try { localStorage.setItem(KEY, v); } catch {}
    window.dispatchEvent(new Event("af-consent"));
  };

  return (
    <>
      {GA_ID && consent === "granted" && <GoogleAnalytics gaId={GA_ID} />}

      {mounted && GA_ID && consent === null && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-navy-700 bg-navy p-4 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#c9d6e8]">
              We use cookies to keep you signed in and, with your consent, to measure traffic.{" "}
              <Link href="/privacy" className="underline hover:text-white">Privacy policy</Link>.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide("denied")}
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Reject
              </Button>
              <Button size="sm" onClick={() => decide("granted")} className="bg-white text-navy hover:bg-white/90">
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
