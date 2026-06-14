"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, FileText, LineChart, BookOpen, HelpCircle, Building2, Mail, ShieldCheck, CreditCard } from "lucide-react";
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

const RESEARCH = [
  { href: "/reports", label: "Reports", desc: "Browse the latest published editions.", icon: FileText },
  { href: "/track-record", label: "Track record", desc: "Every call, scored against the tape.", icon: LineChart },
  { href: "/how-it-works", label: "How it works", desc: "Published before the move, graded after.", icon: BookOpen },
];
const COMPANY = [
  { href: "/about", label: "About", desc: "Who we are and what we stand for.", icon: Building2 },
  { href: "/faq", label: "FAQ", desc: "Common questions, answered.", icon: HelpCircle },
  { href: "/contact", label: "Contact", desc: "Reach us about anything.", icon: Mail },
  { href: "/terms", label: "Terms", desc: "The terms of using AssetFrame.", icon: FileText },
  { href: "/privacy", label: "Privacy", desc: "How we handle your data.", icon: ShieldCheck },
];
const PRICING = { href: "/pricing", label: "Pricing", desc: "Free Snapshots, and what Pro adds.", icon: CreditCard };
// Mobile is a flat list of every page (the sheet scrolls if it overflows).
const MOBILE = [...RESEARCH, PRICING, ...COMPANY];

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
  const [shown, setShown] = useState(!isHome);
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
      if (isHome) setShown(y > 64);
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

        {/* desktop */}
        <div className="hidden items-center gap-3 sm:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-sm font-semibold text-ink hover:text-navy data-[state=open]:text-navy">
                  Research
                </NavigationMenuTrigger>
                <NavigationMenuContent><MenuGrid items={RESEARCH} /></NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  active={isActive("/pricing")}
                  className="px-3 py-1.5 text-sm font-semibold text-ink hover:text-navy data-active:bg-tile data-active:text-navy"
                >
                  <Link href="/pricing">Pricing</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-sm font-semibold text-ink hover:text-navy data-[state=open]:text-navy">
                  Company
                </NavigationMenuTrigger>
                <NavigationMenuContent><MenuGrid items={COMPANY} /></NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <div className="flex items-center gap-3 border-l border-line pl-3">
            <HeaderAuth />
          </div>
        </div>

        {/* mobile */}
        <div className="sm:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-72 flex-col gap-0 overflow-y-auto">
              <SheetTitle className="px-4 pt-4 text-navy">Menu</SheetTitle>
              <nav className="mt-2 flex flex-col px-2">
                {MOBILE.map((n) => (
                  <SheetClose asChild key={n.href}>
                    <Link
                      href={n.href}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-sm font-semibold",
                        isActive(n.href) ? "bg-tile text-navy" : "text-ink hover:bg-muted"
                      )}
                    >
                      {n.label}
                    </Link>
                  </SheetClose>
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
