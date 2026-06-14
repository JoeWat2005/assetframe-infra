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

  if (bare) return <main className="flex-1">{children}</main>;

  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
