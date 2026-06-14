"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Global: when an internal link/button is clicked while the page is scrolled down,
// smooth-scroll to the top first, then navigate — so every navigation glides up
// instead of jumping. External links, new-tab, downloads, hashes, and modifier
// clicks pass through untouched.
export default function SmoothNav() {
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || a.getAttribute("target") === "_blank" || a.hasAttribute("download")) return;
      if (window.scrollY <= 0) return; // already at top: let Next navigate normally

      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => router.push(href), 320);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  return null;
}
