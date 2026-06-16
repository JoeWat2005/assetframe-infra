import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Layers, Clock, BadgeCheck, Flame, Target } from "lucide-react";
import { getCatalog, getTrackRecord } from "@/lib/content";
import { Section } from "@/components/ui";
import ReportCard from "@/components/ReportCard";
import Countdown from "@/components/Countdown";
import HeroBackdrop from "@/components/HeroBackdrop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE } from "@/site.config";

// Title/description are inherited from the root layout (the brand default); set only the
// canonical so the homepage resolves to the site root rather than any query-string variant.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Social links surfaced under the proof section (only the ones filled in site.config).
const SOCIAL_LABELS: Record<string, string> = {
  x: "X", linkedin: "LinkedIn", youtube: "YouTube", reddit: "Reddit", instagram: "Instagram",
};

// Publishing model: editions change only when a new one is published, so serve a
// cached static render and revalidate in the background. Fast for everyone, light on the DB.
export const revalidate = 300;

const WHAT = [
  {
    icon: Layers,
    title: "We cover the instrument",
    body: "Stocks, crypto, FX, commodities and indices — one focused edition per name.",
  },
  {
    icon: Clock,
    title: "Published before the move",
    body: "A clear directional read, the key levels and the catalysts that matter — out ahead of the session.",
  },
  {
    icon: BadgeCheck,
    title: "Scored after the fact",
    body: "Every call is logged before its window and graded against the tape — a public, honest track record.",
  },
];

export default async function Home() {
  const editions = await getCatalog();
  const catalog = editions.slice(0, 6);
  const tr = await getTrackRecord();

  // Hero proof strip — REAL platform numbers only, never invented. Directional accuracy
  // ("—" until ≥1 window scores) and forecasts scored (0 today) fill in automatically as
  // the open calls close, so the strip is a live audit trail, not a marketing stat block.
  const proof: { value: React.ReactNode; label: string }[] = [
    { value: editions.length, label: "Reports published" },
    { value: tr.stats.hitRate === null ? "—" : `${tr.stats.hitRate}%`, label: "Directional accuracy" },
    { value: "100%", label: "Public archive" },
    { value: tr.stats.predictionsGraded, label: "Forecasts scored" },
  ];

  // Social-proof inputs (real platform data only). The scored-calls teaser shows the most
  // recent graded rows; everything degrades gracefully when nothing has scored yet.
  const latestScored = [...tr.scored]
    .sort((a, b) => (b.windowEnd || "").localeCompare(a.windowEnd || ""))
    .slice(0, 3);
  const socials = Object.entries(SITE.socials).filter(([, url]) => url);

  return (
    <>
      {/* -mt-14 cancels AppFrame's reserved header height so the hero is full-bleed to the
          very top (the header is hidden here until you scroll past the fold). min-h-[100dvh]
          only on sm+ : on mobile the hero is content-height so the countdown strip sits right
          beneath it instead of being pushed off the fold. */}
      <div className="-mt-14 flex flex-col sm:min-h-[100dvh]">
      <section className="relative isolate flex flex-1 items-center overflow-hidden bg-navy text-white">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-14" data-animate="hero">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
            <ShieldCheck className="size-3.5 text-[#7fb0ff]" />
            Agentic research desk · human oversight
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Next-session market intelligence,{" "}
            <span className="text-[#7fb0ff]">scored after the fact.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#c9d6e8]">
            Daily pre-session research across key financial assets. Every report is published before the
            move and scored publicly afterwards.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Coverage across stocks, crypto, FX and commodities.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="h-11 bg-white px-6 text-base text-navy shadow-sm hover:bg-white/90">
              <Link href="/reports">Browse reports</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/track-record">
                See the track record
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          {/* Public forecast ledger — compact audit strip, real numbers only (no invented figures) */}
          <div className="mt-8 border-t border-white/10 pt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Public forecast ledger
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-7 gap-y-2.5">
              {proof.map((p) => (
                <div key={p.label} className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-bold tabular-nums text-white">{p.value}</span>
                  <span className="text-xs text-white/70">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* slim next-edition strip — keeps the hero uncluttered. On mobile it adds extra
          bottom padding + the iOS safe-area inset so the timer tiles clear the browser's
          floating bottom toolbar (which was overlapping them); desktop is unchanged. */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-4 px-4 pt-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] sm:px-5 sm:py-3">
          <div>
            <span className="text-sm font-semibold text-ink">Next edition publishes in</span>
            <span className="block text-xs text-muted-foreground">{SITE.publish.label}</span>
          </div>
          <Countdown tone="light" showLabel={false} />
        </div>
      </div>
      </div>

      <Section
        title="What AssetFrame does"
        lead="Independent, accountable market research — not tips, not signals, and never a recommendation to buy or sell."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {WHAT.map((w) => (
            <Card key={w.title} data-animate="up">
              <CardContent>
                <w.icon className="size-5 text-navy" />
                <div className="mt-3 text-base font-bold text-ink">{w.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground" data-animate="up">
          Every edition is produced by an <span className="font-semibold text-ink">agentic research team</span> —
          specialist AI agents pull the market data, research the catalysts and draft the analysis — with
          <span className="font-semibold text-ink"> human oversight</span> reviewing each edition before it is published.
        </p>
      </Section>

      <Section title="Latest editions" lead="A directional read and the levels that matter on each instrument. Open one to read the full report.">
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No editions published yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((e) => (
              <ReportCard key={`${e.date}/${e.slug}`} e={e} />
            ))}
          </div>
        )}
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/reports">
              All reports
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Social proof — REAL platform numbers only. The ledger strip and scored-calls teaser
          fill in as open calls close; before then they read "—"/"scoring begins…", never an
          invented stat. */}
      <Section
        title="A public, scored track record"
        lead="No cherry-picking. Every call is registered before its window and graded against the tape afterwards — the record is the product."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card data-animate="up">
            <CardContent>
              <Target className="size-5 text-navy" />
              <div className="mt-3 font-mono text-3xl font-extrabold tabular-nums text-navy">
                {tr.stats.hitRate === null ? "—" : `${tr.stats.hitRate}%`}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Overall hit rate across {tr.stats.predictionsGraded} scored forecast{tr.stats.predictionsGraded === 1 ? "" : "s"}.
              </div>
            </CardContent>
          </Card>
          <Card data-animate="up">
            <CardContent>
              <Flame className="size-5 text-navy" />
              <div className="mt-3 font-mono text-3xl font-extrabold tabular-nums text-navy">
                {tr.stats.currentStreak}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Current winning streak{tr.stats.longestStreak > 0 ? ` · longest ${tr.stats.longestStreak}` : ""}.
              </div>
            </CardContent>
          </Card>
          <Card data-animate="up">
            <CardContent>
              <BadgeCheck className="size-5 text-navy" />
              <div className="mt-3 text-sm font-bold text-ink">Latest scored calls</div>
              {latestScored.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Scoring begins as the first windows close. Until then, every open call is public.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {latestScored.map((r, i) => (
                    <li key={`${r.instrument}-${r.windowEnd}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink">{r.instrument}</span>
                      <span className="shrink-0 text-muted-foreground">{r.results || (r.hitRate === "" ? "" : `${r.hitRate}%`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button asChild variant="outline">
            <Link href="/track-record">
              See the full track record
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          {socials.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Follow along:</span>
              {socials.map(([key, url]) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline">
                  {SOCIAL_LABELS[key] ?? key}
                </a>
              ))}
            </div>
          )}
        </div>
      </Section>

      <div className="h-12" />
    </>
  );
}
