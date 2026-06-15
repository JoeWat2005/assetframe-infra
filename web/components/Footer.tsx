import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/site.config";

// Minimal inline icons (no icon dependency). Add/remove by editing SITE.socials.
const ICONS: Record<string, string> = {
  x: "M18.9 2H22l-7.6 8.7L23 22h-6.8l-5-6.6L5.4 22H2.3l8.2-9.4L1.5 2h7l4.5 6 5.9-6Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z",
  linkedin: "M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0ZM.3 8h4.4v13H.3V8Zm7.2 0h4.2v1.8h.06c.6-1.1 2-2.2 4.1-2.2 4.4 0 5.2 2.9 5.2 6.6V21h-4.4v-5.9c0-1.4 0-3.2-2-3.2s-2.2 1.5-2.2 3.1V21H7.5V8Z",
  youtube: "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z",
  reddit: "M22 12a2.1 2.1 0 0 0-3.6-1.5 10.3 10.3 0 0 0-5.3-1.7l.9-4.2 2.9.6a1.5 1.5 0 1 0 .2-1l-3.3-.7-1.2 5.3a10.3 10.3 0 0 0-5.4 1.7 2.1 2.1 0 1 0-2.3 3.5 4 4 0 0 0 0 .6c0 3 3.6 5.5 8 5.5s8-2.5 8-5.5a4 4 0 0 0 0-.6A2.1 2.1 0 0 0 22 12Zm-13 1.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm8.4 4c-1 1-3 1.1-3.4 1.1s-2.4 0-3.4-1.1a.4.4 0 0 1 .5-.5c.7.6 2 .8 2.9.8s2.2-.2 2.9-.8a.4.4 0 1 1 .5.5Zm-.4-2.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
  instagram: "M12 2.2c3.2 0 3.6 0 4.9.07 3.3.15 4.8 1.7 4.96 4.96.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.15 3.25-1.66 4.8-4.96 4.96-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-3.3-.15-4.8-1.71-4.96-4.96C2.04 15.6 2.03 15.2 2.03 12s0-3.6.07-4.9C2.25 3.85 3.76 2.3 7.06 2.14 8.36 2.08 8.76 2.07 12 2.07Zm0 3.13A6.86 6.86 0 1 0 12 18.9a6.86 6.86 0 0 0 0-13.72Zm0 11.32a4.46 4.46 0 1 1 0-8.92 4.46 4.46 0 0 1 0 8.92Zm7.13-11.6a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0Z",
};

const SOCIAL_LABELS: Record<string, string> = {
  x: "AssetFrame on X", linkedin: "AssetFrame on LinkedIn", youtube: "AssetFrame on YouTube",
  reddit: "AssetFrame on Reddit", instagram: "AssetFrame on Instagram",
};

function Social() {
  const entries = Object.entries(SITE.socials).filter(([, url]) => url);
  if (!entries.length) return null;
  return (
    <div className="flex gap-1">
      {entries.map(([key, url]) => (
        // size-9 gives a ≥24px hit area (WCAG 2.5.8); aria-label names the link (svg hidden).
        <a key={key} href={url} target="_blank" rel="noopener noreferrer"
           aria-label={SOCIAL_LABELS[key] ?? `AssetFrame on ${key}`}
           className="inline-flex size-9 items-center justify-center rounded-md text-[#aebfd6] hover:bg-white/5 hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={ICONS[key] ?? ""} />
          </svg>
        </a>
      ))}
    </div>
  );
}

export default function Footer() {
  const year = "2026";
  return (
    <footer className="mt-14 bg-navy text-[#aebfd6]">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <Image src="/logo-white.png" alt={SITE.brand} width={150} height={30} className="h-7 w-auto" />
            <p className="mt-2 text-sm">{SITE.tagline}</p>
            <div className="mt-4"><Social /></div>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <Link href="/reports" className="hover:text-white">Reports</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/track-record" className="hover:text-white">Track record</Link>
            <Link href="/how-it-works" className="hover:text-white">How it works</Link>
            <Link href="/faq" className="hover:text-white">FAQ</Link>
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/account" className="hover:text-white">Account</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/accessibility" className="hover:text-white">Accessibility</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
        <p className="mt-8 border-t border-navy-700 pt-6 text-xs leading-relaxed text-[#7e93b3]">
          {SITE.disclaimer}
        </p>
        <p className="mt-3 text-xs text-[#7e93b3]">© {year} {SITE.brand}. All rights reserved.</p>
      </div>
    </footer>
  );
}
