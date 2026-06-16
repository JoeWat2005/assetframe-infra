import type { Metadata } from "next";
import Link from "next/link";
import { Crosshair, Scale, ListChecks, ArrowRight } from "lucide-react";
import { Hero } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description:
    "About AssetFrame — falsifiable, scored, transparent market research. Every call is published before the session and graded against the tape in an append-only ledger. Decision-support, not regulated financial advice.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  { icon: Crosshair, title: "Falsifiable", body: "Every Pro report logs exact levels and an exact window before the session. A vague take can't be graded; ours can be proven right or wrong." },
  { icon: Scale, title: "Scored", body: "After the window closes we grade each call against the price tape — Hit, Miss or No-trigger. A deterministic engine decides; no human nudges the result." },
  { icon: ListChecks, title: "Transparent", body: "Results land in an append-only ledger. Nothing is edited, re-tuned or cherry-picked, and the whole record is public. The record is the product." },
];

export default function AboutPage() {
  return (
    <>
      <Hero title="About AssetFrame" tag="Market research you can hold to account." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink" data-animate="up">
          <p>
            <b>AssetFrame</b> publishes pre-session research on the instruments that matter, then scores it after
            the fact. For each edition we ship a free one-page <b>Snapshot</b> for everyone and a full <b>Pro</b>{" "}
            report with conditional setups, a price ladder, a calibrated confidence score and the outcome ledger.
          </p>
          <p>
            Most market commentary is never checked. A call that&rsquo;s never measured can&rsquo;t be wrong, so it
            can never really be right either. We do the opposite: every prediction is registered{" "}
            <b>before</b> the session opens and graded against the tape afterwards, so the record speaks for itself.
          </p>
        </div>

        <h2 className="mt-10 mb-3 text-xl font-bold text-navy" data-animate="up">Our mission</h2>
        <p className="text-[15px] leading-relaxed text-ink" data-animate="up">
          To make market research <b>falsifiable, scored and transparent</b>. We think the only honest way to earn
          trust is to commit to specific, checkable calls in advance and then publish how they turned out — wins and
          losses alike. That accountability is the whole point: the track record, not the rhetoric, is what you should
          judge us on.
        </p>

        <h2 className="mt-10 mb-4 text-xl font-bold text-navy" data-animate="up">What we stand for</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <Card key={p.title} data-animate="up" className="p-5">
              <CardContent className="px-0">
                <div className="flex size-9 items-center justify-center rounded-xl bg-navy text-white">
                  <p.icon className="size-5" />
                </div>
                <div className="mt-3 font-bold text-navy">{p.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="mt-10 mb-2 text-xl font-bold text-navy" data-animate="up">What AssetFrame is</h2>
        <p className="text-[15px] leading-relaxed text-ink" data-animate="up">
          A research and decision-support service. An AI analyst writes the thesis, scenarios and catalysts; a
          deterministic Python engine compiles the price levels, the conditional setups and an auditable confidence
          score, and registers the falsifiable predictions. After each window closes, outcomes are graded into a
          public, append-only ledger — which then feeds back in as an input, so the system learns which setups and
          market regimes have actually worked. It&rsquo;s built for anyone who wants a structured, evidence-led read on
          an instrument before the session: active traders and investors, the merely curious, and the developers and
          AI agents who want the same data programmatically.
        </p>

        <h2 className="mt-10 mb-2 text-xl font-bold text-navy" data-animate="up">What AssetFrame is not</h2>
        <p className="text-[15px] leading-relaxed text-ink" data-animate="up">
          AssetFrame is general market research and decision support. It is <b>not</b> investment advice and not a
          personal recommendation, we never tell anyone to buy or sell, and we place no trades. We don&rsquo;t
          guarantee outcomes — markets are uncertain and you can lose money. A calibrated confidence score is an
          estimate of how a setup may resolve, not a promise of profit. Do your own research and consider an
          FCA-authorised adviser.
        </p>

        <div className="mt-8 flex flex-wrap gap-3" data-animate="up">
          <Button asChild>
            <Link href="/how-it-works">
              How it works
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/track-record">See the track record</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
