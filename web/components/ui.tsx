import Link from "next/link";
import type { ReactNode } from "react";

// Backgrounds carry white text, so each must clear WCAG AA 4.5:1 — sell/high/very-high
// darkened from the original #cf222e/#bc4c00 (which were ~3.5–4.1:1) to pass.
const STATUS: Record<string, string> = {
  buy: "#1a7f37", sell: "#b91c1c", wait: "#9a6700",
  "stand aside": "#57606a", neutral: "#0969da", hold: "#0969da",
};
const RISK: Record<string, string> = {
  low: "#1a7f37", medium: "#9a6700", high: "#9a3d00", "very high": "#b91c1c",
};

export function Badge({ label, kind }: { label: string; kind?: "status" | "risk" }) {
  const map = kind === "risk" ? RISK : STATUS;
  const bg = map[label.trim().toLowerCase()] ?? "#57606a";
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
      style={{ background: bg }}
    >
      {kind === "risk" ? `Risk: ${label}` : label}
    </span>
  );
}

export function Btn({
  href, children, variant = "outline", external, sm,
}: {
  href: string; children: ReactNode;
  variant?: "primary" | "outline" | "pro"; external?: boolean; sm?: boolean;
}) {
  const base = `inline-flex items-center justify-center rounded-lg font-bold transition ${
    sm ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm"
  }`;
  const styles = {
    primary: "bg-navy text-white hover:bg-navy-700",
    outline: "border border-navy text-navy hover:bg-tile",
    pro: "border border-[#9a6700] text-[#9a6700] hover:bg-[#fff7e6]",
  }[variant];
  const rel = external ? "noopener noreferrer" : undefined;
  const target = external ? "_blank" : undefined;
  return (
    <Link href={href} className={`${base} ${styles}`} target={target} rel={rel}>
      {children}
    </Link>
  );
}

export function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-5">
      <div data-animate="up">
        <h2 className="mt-10 mb-1 text-2xl font-bold text-navy">{title}</h2>
        {lead && <p className="mb-4 text-sm text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 rounded-xl border border-[#cdd9ea] bg-tile px-4 py-3 text-sm text-[#33415c]">
      {children}
    </div>
  );
}

export function Hero({ title, tag, children }: { title: string; tag: string; children?: ReactNode }) {
  return (
    <section className="bg-navy text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5 sm:py-14" data-animate="hero">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-base text-[#c9d6e8] sm:text-lg">{tag}</p>
        {children}
      </div>
    </section>
  );
}
