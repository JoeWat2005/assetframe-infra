import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getCatalog, getTrackRecord } from "@/lib/content";
import { Section } from "@/components/ui";
import ReportCard from "@/components/ReportCard";
import Countdown from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE } from "@/site.config";

// Publishing model: editions change only when a new one is published, so serve a
// cached static render and revalidate in the background. Fast for everyone, light on the DB.
export const revalidate = 300;

export default async function Home() {
  const catalog = (await getCatalog()).slice(0, 6);
  const tr = await getTrackRecord();

  const stats: [React.ReactNode, string][] = [
    [tr.stats.reportsScored, "Reports scored"],
    [tr.stats.openCalls, "Open calls"],
    [tr.stats.hitRate === null ? "—" : `${tr.stats.hitRate}%`, "Hit rate"],
    [tr.stats.predictionsGraded, "Predictions graded"],
  ];

  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
            <ShieldCheck className="size-3.5" />
            Published before the move · graded against the tape
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Next-session market intelligence,{" "}
            <span className="text-[#7fb0ff]">scored after the fact.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[#c9d6e8]">
            Pre-session research on the instruments that matter — a free one-page Snapshot for
            everyone, and a full Pro report with conditional setups, a price ladder and a scored
            outcome ledger. Every call is published <b className="text-white">before</b> the outcome
            and graded against the tape afterwards. General market research, not personal advice.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
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

          <div className="mt-10">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-white/50">
              Next edition drops in
            </p>
            <Countdown />
          </div>
        </div>
      </section>

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

      <Section title="Scored, not cherry-picked" lead="The accountability the rest of the industry skips.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([n, l]) => (
            <Card key={l}>
              <CardContent>
                <div className="text-3xl font-extrabold text-navy">{n}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">{l}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Every Pro report registers falsifiable predictions before the window opens; we grade them
          against the tape afterwards and publish the append-only ledger.{" "}
          <Link className="font-semibold text-navy underline underline-offset-2" href="/track-record">
            See it →
          </Link>
        </p>
      </Section>

      <p className="mx-auto mt-10 max-w-5xl px-4 text-xs text-muted-foreground sm:px-5">
        {SITE.disclaimer}
      </p>
      <div className="h-10" />
    </>
  );
}
