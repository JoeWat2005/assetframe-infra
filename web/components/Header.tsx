"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, FileText, LineChart, BookOpen, HelpCircle, Building2, Mail, ShieldCheck, CreditCard, Accessibility, Code2, Star, Terminal, MessageSquare } from "lucide-react";
import HeaderAuth from "@/components/HeaderAuth";
import { SITE } from "@/site.config";
import {
  NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger,
  NavigationMenuContent, NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HOME = process.env.NODE_ENV === "production" ? SITE.url : "/";

// Items within each category are alphabetical by label (per request).
const RESEARCH = [
  { href: "/reports", label: "Reports", desc: "Browse the latest published editions.", icon: FileText },
  { href: "/reviews", label: "Reviews", desc: "What people say about AssetFrame.", icon: Star },
  { href: "/track-record", label: "Track record", desc: "Every call, scored against the tape.", icon: LineChart },
];
const PRODUCT = [
  { href: "/faq", label: "FAQ", desc: "Common questions, answered.", icon: HelpCircle },
  { href: "/how-it-works", label: "How it works", desc: "Published before the move, graded after.", icon: BookOpen },
  { href: "/pricing", label: "Pricing", desc: "Free Snapshots, and what Pro adds.", icon: CreditCard },
];
const DEVELOPERS = [
  { href: "/developers/mcp", label: "MCP server", desc: "Connect Claude, Cursor and other agents.", icon: Terminal },
  { href: "/developers", label: "Overview", desc: "MCP server & API for agents.", icon: Code2 },
  { href: "/developers/api", label: "REST API", desc: "Read-only JSON for catalog & record.", icon: Code2 },
];
const COMPANY = [
  { href: "/about", label: "About", desc: "Who we are and what we stand for.", icon: Building2 },
  { href: "/accessibility", label: "Accessibility", desc: "Our WCAG 2.2 AA commitment.", icon: Accessibility },
  { href: "/contact", label: "Contact", desc: "Reach us about anything.", icon: Mail },
  { href: "/feedback", label: "Feedback", desc: "Tell us what to build or cover next.", icon: MessageSquare },
  { href: "/privacy", label: "Privacy", desc: "How we handle your data.", icon: ShieldCheck },
  { href: "/terms", label: "Terms", desc: "The terms of using AssetFrame.", icon: FileText },
];
// Categories in alphabetical order — drives both desktop dropdowns and grouped mobile sections.
const NAV = [
  { title: "Company", items: COMPANY },
  { title: "Developers", items: DEVELOPERS },
  { title: "Product", items: PRODUCT },
  { title: "Research", items: RESEARCH },
];

function MenuGrid({ items }: { items: typeof RESEARCH }) {
  return (
    <ul className="grid w-[440px] gap-1 p-2">
      {items.map((r) => (
        <li key={r.href}>
          <NavigationMenuLink asChild>
            <Link href={r.href} className="flex gap-3 rounded-lg p-2.5 hover:bg-tile">
              <r.icon className="mt-0.5 size-4 shrink-0 text-navy" />
              <span className="block">
                <span className="block text-sm font-semibold text-ink">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.desc}</span>
              </span>
            </Link>
          </NavigationMenuLink>
        </li>
      ))}
    </ul>
  );
}

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  // Start hidden on every render path (incl. static generation, where usePathname is null):
  // the scroll effect below sets the right state on mount, so the navbar never paints a
  // stray bar over the home hero before hydration.
  const [shown, setShown] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Home: the header is hidden over the full-screen hero and reveals once you scroll
  // past the fold. Every other page: it's visible at the top, hides as you scroll down
  // (more reading room), and comes back as you scroll up. rAF-throttled, passive.
  useEffect(() => {
    setShown(!isHome);
    let lastY = window.scrollY;
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      if (isHome) setShown(y > window.innerHeight - 64); // reveal only after the full-screen hero, so the white navbar never sits over it
      else if (y <= 64) setShown(true); // near the top (within the reserved header zone): always shown
      else if (y > lastY + 4) setShown(false); // scrolling down past the fold: hide
      else if (y < lastY - 4) setShown(true); // scrolling up: show
      lastY = y;
      ticking = false;
    };
    apply();
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-transform duration-300 motion-reduce:transition-none",
        shown
          ? "translate-y-0 border-line bg-white/90 shadow-sm backdrop-blur supports-backdrop-filter:bg-white/80"
          : "-translate-y-full border-transparent"
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-5">
        <a href={HOME} className="flex items-center" aria-label={SITE.brand}>
          <Image src="/logo.png" alt={SITE.brand} width={124} height={25} priority className="h-6 w-auto" />
        </a>

        {/* desktop — only at lg+; below that the mega-menu cramps/overflows, so use the sheet */}
        <div className="hidden items-center gap-3 lg:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-1">
              {/* right-align: the triggers sit in a right-aligned cluster, so a left-anchored
                  440px panel would overflow the viewport. right-0 makes it extend leftward. */}
              {NAV.map((group) => (
                <NavigationMenuItem key={group.title}>
                  <NavigationMenuTrigger className="bg-transparent text-sm font-semibold text-ink hover:text-navy data-[state=open]:text-navy">
                    {group.title}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="left-auto right-0"><MenuGrid items={group.items} /></NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="flex items-center gap-3 border-l border-line pl-3">
            <HeaderAuth />
          </div>
        </div>

        {/* mobile + tablet (below lg) — the hamburger sheet */}
        <div className="lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-72 flex-col gap-0 overflow-y-auto">
              <SheetTitle className="px-4 pt-4 text-navy">Menu</SheetTitle>
              {/* Grouped by category with headings (mirrors the desktop dropdowns) so the
                  list reads as sections rather than one long scroll. */}
              <nav className="mt-2 flex flex-col gap-1 px-2 pb-2">
                {NAV.map((group) => (
                  <div key={group.title} className="mt-2 first:mt-0">
                    <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </div>
                    {group.items.map((n) => (
                      <SheetClose asChild key={n.href}>
                        <Link
                          href={n.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
                            isActive(n.href) ? "bg-tile text-navy" : "text-ink hover:bg-muted"
                          )}
                        >
                          <n.icon className="size-4 shrink-0 text-navy" />
                          {n.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </div>
                ))}
              </nav>
              <div className="mt-3 border-t border-line px-2 pt-3">
                <HeaderAuth mobile onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
