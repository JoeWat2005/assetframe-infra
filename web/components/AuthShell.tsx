import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, LineChart, Lock } from "lucide-react";
import { SITE } from "@/site.config";

// Full-screen auth layout (no marketing nav/footer): a navy brand panel on desktop
// next to the centred Clerk widget. On mobile the brand panel collapses and a logo
// sits above the form. Uses min-h-[100dvh] so it fills the screen and scrolls if the
// form is taller than the viewport.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex">
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(155deg, #0b2545 0%, #102f56 55%, #0a2140 100%)" }} />
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(42rem 26rem at 18% 4%, rgba(127,176,255,0.18), transparent 60%)" }} />
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <Link href="/" className="relative z-10 inline-flex">
          <Image src="/logo-white.png" alt={SITE.brand} width={160} height={32} className="h-7 w-auto" />
        </Link>
        <div className="relative z-10">
          <h2 className="max-w-sm text-2xl font-bold leading-snug">
            Next-session market intelligence, <span className="text-[#7fb0ff]">scored after the fact.</span>
          </h2>
          <ul className="mt-6 flex flex-col gap-3 text-sm text-[#c9d6e8]">
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#7fb0ff]" /> Free one-page Snapshots, instantly</li>
            <li className="flex items-center gap-2"><LineChart className="size-4 text-[#7fb0ff]" /> A public, scored track record</li>
            <li className="flex items-center gap-2"><Lock className="size-4 text-[#7fb0ff]" /> Pro reports with the full outcome ledger</li>
          </ul>
        </div>
        <p className="relative z-10 text-xs text-[#7e93b3]">
          {SITE.brand} publishes general market research, not personal advice.
        </p>
      </div>

      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-gradient-to-b from-white to-[#eef2f8] px-5 py-10">
        <Link href="/" className="md:hidden">
          <Image src="/logo.png" alt={SITE.brand} width={140} height={28} className="h-7 w-auto" priority />
        </Link>
        {children}
      </div>
    </div>
  );
}
