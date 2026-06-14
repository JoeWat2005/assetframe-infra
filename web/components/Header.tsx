"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, FileText, LineChart, BookOpen, HelpCircle } from "lucide-react";
import HeaderAuth from "@/components/HeaderAuth";
import { SITE } from "@/site.config";
import {
  NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger,
  NavigationMenuContent, NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Brand link points at the canonical domain in production (never the *.vercel.app host).
const HOME = process.env.NODE_ENV === "production" ? SITE.url : "/";

const RESEARCH = [
  { href: "/reports", label: "Reports", desc: "Browse the latest Snapshot + Pro editions.", icon: FileText },
  { href: "/track-record", label: "Track record", desc: "Every call, scored against the tape.", icon: LineChart },
  { href: "/how-it-works", label: "How it works", desc: "Published before the move, graded after.", icon: BookOpen },
  { href: "/faq", label: "FAQ", desc: "Common questions, answered.", icon: HelpCircle },
];
const FLAT = [{ href: "/pricing", label: "Pricing" }];
const MOBILE_LINKS = [...RESEARCH.map(({ href, label }) => ({ href, label })), ...FLAT];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/75">
      {/* compliance / utility strip (desktop) */}
      <div className="hidden border-b border-line/70 bg-tile/60 sm:block">
        <div className="mx-auto flex h-8 max-w-5xl items-center justify-between px-4 text-[12px] text-muted-foreground sm:px-5">
          <span>
            Research published <b className="text-ink">before</b> the move, graded against the tape after.
          </span>
          <Link href="/track-record" className="font-semibold text-navy hover:underline">
            See the track record →
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-5">
        <a href={HOME} className="flex items-center" aria-label={SITE.brand}>
          <Image src="/logo.png" alt={SITE.brand} width={124} height={25} priority className="h-6 w-auto" />
        </a>

        {/* desktop nav */}
        <div className="hidden items-center gap-3 sm:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-sm font-semibold text-ink hover:text-navy data-[state=open]:text-navy">
                  Research
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[480px] grid-cols-2 gap-1 p-2">
                    {RESEARCH.map((r) => (
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
                </NavigationMenuContent>
              </NavigationMenuItem>
              {FLAT.map((n) => (
                <NavigationMenuItem key={n.href}>
                  <NavigationMenuLink
                    asChild
                    active={isActive(n.href)}
                    className="px-3 py-1.5 text-sm font-semibold text-ink hover:text-navy data-active:bg-tile data-active:text-navy"
                  >
                    <Link href={n.href}>{n.label}</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
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
            <SheetContent side="right" className="w-72 gap-0">
              <SheetTitle className="px-4 pt-4 text-navy">Menu</SheetTitle>
              <nav className="mt-2 flex flex-col px-2">
                {MOBILE_LINKS.map((n) => (
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
              <div className="mt-3 flex items-center gap-3 border-t border-line px-4 pt-4">
                <HeaderAuth />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
