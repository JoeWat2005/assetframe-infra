import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getCatalog, getTrackRecord } from "@/lib/content";
import { Section } from "@/components/ui";
import ReportCard from "@/components/ReportCard";
import Countdown from "@/components/Countdown";
import HeroBackdrop from "@/components/HeroBackdrop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Publishing model: editions change only when a new one is published, so serve a
// cached static render and revalidate in the background. Fast for everyone, light on the DB.
export const revalidate = 300;

export default async function Home() {
  const catalog = (await getCatalog()).slice(0, 6);
  const tr = await getTrackRecord();

  const stats: [React.ReactNode, string][] = [
    [tr.stats.hitRate === null ? "—" : `${tr.stats.hitRate}%`, "Hit rate"],
    [tr.stats.longestStreak, "Longest streak"],
    [tr.stats.reportsScored, "Reports scored"],
    [tr.stats.predictionsGraded, "Predictions graded"],
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-20 sm:px-5 sm:py-24" data-animate="hero">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
            <ShieldCheck className="size-3.5 text-[#7fb0ff]" />
            Published before the move, graded after
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Next-session market intelligence,{" "}
            <span className="text-[#7fb0ff]">scored after the fact.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#c9d6e8]">
            A free one-page Snapshot for everyone, plus a Pro report with conditional setups, a price
            ladder and a scored ledger.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="h-11 bg-white px-6 text-base text-navy shadow-sm hover:bg-white/90">
              <Link href="/reports">Browse free reports</Link>
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
        </div>
      </section>

      {/* slim next-edition strip — keeps the hero uncluttered */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="text-sm font-semibold text-ink">Next edition drops in</span>
          <Countdown tone="light" showLabel={false} />
        </div>
      </div>

      <Section title="Latest editions" lead="Free Snapshots open in your browser. Pro reports unlock with a subscription.">
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

      <Section title="How accurate are we?" lead="Don't take our word for it. Here's the running scorecard.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([n, l]) => (
            <Card key={l} data-animate="up">
              <CardContent>
                <div className="text-3xl font-extrabold text-navy">{n}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">{l}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        {tr.stats.reportsScored === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No reports scored yet. The first results post as the current open calls close.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {tr.stats.currentStreak > 0 ? `Currently on a ${tr.stats.currentStreak}-report accurate streak. ` : ""}
            Every prediction is registered before its window and graded after. The full append-only
            record is part of Pro.{" "}
            <Link className="font-semibold text-navy underline underline-offset-2" href="/track-record">
              See the full record →
            </Link>
          </p>
        )}
      </Section>

      <div className="h-12" />
    </>
  );
}
