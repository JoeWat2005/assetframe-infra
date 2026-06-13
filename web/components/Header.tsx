"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import HeaderAuth from "@/components/HeaderAuth";
import { SITE } from "@/site.config";

const NAV = [
  { href: "/reports", label: "Reports" },
  { href: "/track-record", label: "Track record" },
  { href: "/pricing", label: "Pricing" },
];

// Brand link points at the canonical domain in production (so the logo never sends
// people to the *.vercel.app host), but stays local during development.
const HOME = process.env.NODE_ENV === "production" ? SITE.url : "/";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-5">
        <a href={HOME} className="flex items-center" aria-label={SITE.brand}>
          <Image src="/logo.png" alt={SITE.brand} width={124} height={25} priority className="h-6 w-auto" />
        </a>

        {/* desktop nav */}
        <nav className="hidden items-center gap-5 sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-semibold text-muted hover:text-navy">
              {n.label}
            </Link>
          ))}
          <HeaderAuth />
        </nav>

        {/* mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line sm:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-navy">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* mobile panel */}
      {open && (
        <div className="border-t border-line bg-white sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-sm font-semibold text-ink last:border-0"
              >
                {n.label}
              </Link>
            ))}
            <div className="flex items-center gap-3 py-3" onClick={() => setOpen(false)}>
              <HeaderAuth />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
