"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Auth pages are full-screen with no marketing nav/footer (the standard). Everything
// else gets the normal header + footer. Header/Footer are passed in as already-rendered
// nodes so they stay server components.
export default function AppFrame({
  header, footer, children,
}: { header: ReactNode; footer: ReactNode; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const bare = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (bare) return <main id="main-content" className="flex-1">{children}</main>;

  // The header is fixed, so every page reserves its height (pt-14) to keep content clear
  // of it. This is deterministic — no client-only pathname branch — so statically-rendered
  // pages never flash a reserved gap (or a stray navbar bar) before hydration. The home
  // page cancels this with a `-mt-14` on its hero, so the hero sits full-bleed under the
  // (initially hidden) header that only reveals once you scroll past the fold.
  return (
    <>
      {/* WCAG 2.4.1 — keyboard users can jump past the nav straight to content. */}
      <a
        href="#main-content"
        className="sr-only rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[100]"
      >
        Skip to content
      </a>
      {header}
      <main id="main-content" className="flex-1 pt-14">{children}</main>
      {footer}
    </>
  );
}
