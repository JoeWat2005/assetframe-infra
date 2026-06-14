import type { Metadata } from "next";
import Link from "next/link";
import { Crosshair, Scale, ListChecks, ArrowRight } from "lucide-react";
import { Hero } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "About" };

const PRINCIPLES = [
  { icon: Crosshair, title: "Falsifiable", body: "Every Pro report logs exact levels and an exact window before the session. Vague takes can't be graded; ours can." },
  { icon: Scale, title: "Scored", body: "After the window closes we grade each call against the price tape: Hit, Miss or No-trigger. No human nudges the result." },
  { icon: ListChecks, title: "Transparent", body: "Results land in an append-only ledger. Nothing is edited, re-tuned or cherry-picked. The track record is the product." },
];

export default function AboutPage() {
  return (
    <>
      <Hero title="About AssetFrame" tag="Market research you can hold to account." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink" data-animate="up">
          <p>
            <b>AssetFrame</b> publishes pre-session research on the instruments that matter: a free one-page
            Snapshot for everyone, and a full Pro report with conditional setups, a price ladder and the
            outcome ledger.
          </p>
          <p>
            Most market commentary is never checked. We do the opposite. Every call is published{" "}
            <b>before</b> the outcome is known and graded against the tape afterwards, so the record speaks
            for itself.
          </p>
        </div>

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

        <h2 className="mt-10 mb-2 text-xl font-bold text-navy" data-animate="up">What we are not</h2>
        <p className="text-[15px] leading-relaxed text-ink" data-animate="up">
          AssetFrame is general market research and decision support. It is not investment advice and not a
          personal recommendation, we never tell anyone to buy or sell, and we place no trades. Markets are
          uncertain and you can lose money. Do your own research and consider an FCA-authorised adviser.
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
