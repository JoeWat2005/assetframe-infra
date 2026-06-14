"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Isolated GSAP motion layer (no Framer in this tree). Reveals elements tagged
// data-animate="hero" (load-in, staggered) and data-animate="up" (scroll reveal).
// Pre-hide is done in CSS scoped to html.gsap-on (set before paint by an inline
// script in layout) so there's no flash. Robustness guarantees:
//  - a MutationObserver reveals data-animate nodes that mount AFTER setup (e.g. the
//    filtered results in ReportsBrowser), so client lists are never stranded hidden;
//  - a watchdog removes gsap-on if GSAP is slow/fails, so content can't stay invisible;
//  - reduced-motion is respected (and re-checked on change).
export default function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      root.classList.remove("gsap-on");
      return;
    }

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    let mo: MutationObserver | undefined;
    const watchdog = window.setTimeout(() => root.classList.remove("gsap-on"), 1800);

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        window.clearTimeout(watchdog);
        gsap.registerPlugin(ScrollTrigger);

        const reveal = (els: Element[]) =>
          gsap.to(els, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.05, overwrite: true });

        ctx = gsap.context(() => {
          // Hero/title reveal is handled by CSS (see globals.css) so it can't be
          // stranded invisible if this runs late or gets reverted on navigation.
          const ups = gsap.utils.toArray<HTMLElement>('[data-animate="up"]');
          gsap.set(ups, { y: 22, opacity: 0 });
          ScrollTrigger.batch(ups, {
            start: "top 90%",
            onEnter: (els) => reveal(els as unknown as Element[]),
          });
          ScrollTrigger.refresh();
        });

        // Catch data-animate nodes added after setup (filtered/sorted client lists,
        // expanded panels) and reveal them so they can never be left at opacity:0.
        mo = new MutationObserver((mutations) => {
          const added: Element[] = [];
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (!(node instanceof HTMLElement)) continue;
              if (node.matches("[data-animate]")) added.push(node);
              node.querySelectorAll("[data-animate]").forEach((x) => added.push(x));
            }
          }
          if (added.length) { gsap.set(added, { y: 16 }); reveal(added); }
        });
        mo.observe(document.body, { childList: true, subtree: true });
      } catch {
        root.classList.remove("gsap-on"); // never leave content stuck hidden
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      mo?.disconnect();
      ctx?.revert();
    };
  }, [pathname]);

  return null;
}
