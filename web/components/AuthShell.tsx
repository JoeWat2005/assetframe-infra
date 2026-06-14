import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, LineChart, Lock } from "lucide-react";
import HeroBackdrop from "@/components/HeroBackdrop";
import { SITE } from "@/site.config";

// Full-screen auth layout (no marketing nav/footer): a navy brand panel on desktop
// next to the centred Clerk widget. On mobile the brand panel collapses and a logo
// sits above the form. Uses min-h-[100dvh] so it fills the screen and scrolls if the
// form is taller than the viewport.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white md:flex">
        <HeroBackdrop />
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
