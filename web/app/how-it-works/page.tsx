import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb, Cpu, Crosshair, Send, Scale, ListChecks, Bell, Plug, ArrowRight } from "lucide-react";
import { Hero } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How AssetFrame works: an AI analyst writes the thesis, a deterministic engine compiles levels, a calibrated confidence score and falsifiable predictions, every report is published before the session, then graded Hit / Miss / No-trigger against the tape in an append-only ledger.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  { icon: Lightbulb, title: "Research", body: "An AI analyst studies the instrument and writes the thesis, the scenarios and the catalysts that could move it — the qualitative view, in plain English." },
  { icon: Cpu, title: "Compile", body: "A deterministic Python engine (Engine V2) turns that view into numbers: pivots and price levels, conditional long/short setups with risk:reward, and a calibrated confidence score. Same inputs, same output — every figure is reproducible." },
  { icon: Crosshair, title: "Register", body: "Before the session opens, the engine logs falsifiable predictions — exact levels and an exact window. Each one can be proven right or wrong; nothing is left vague." },
  { icon: Send, title: "Publish", body: "The free Snapshot opens for everyone and the Pro report unlocks with a subscription, served from a CDN so it stays fast at any traffic. Both render from one canonical payload behind a strict QA gate." },
  { icon: Scale, title: "Score", body: "After the window closes, the engine grades each prediction against the actual price tape — Hit, Miss or No-trigger — with no human nudging the result." },
  { icon: ListChecks, title: "Append & learn", body: "Results land in an append-only ledger that's never edited or re-tuned. The ledger is also an input: the engine learns which setups and regimes have worked — with no look-ahead, since a call is only ever scored after its window." },
];

export default function HowItWorksPage() {
  return (
    <>
      <Hero title="How it works" tag="An analyst writes the thesis. An engine makes it falsifiable. The tape grades it. Nothing gets rewritten." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="mb-6 text-[15px] leading-relaxed text-ink" data-animate="up">
          Every AssetFrame edition runs through the same pipeline — research, compile, register, publish, score, append.
          The qualitative work is done by an AI analyst; the numbers, the predictions and the scoring are done by a
          deterministic engine, so the parts you&rsquo;re asked to trust are the parts that can be audited.
        </p>
        <ol className="flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} data-animate="up">
              <Card className="flex-row items-start gap-4 p-5 sm:p-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                  <s.icon className="size-5" />
                </div>
                <CardContent className="px-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <h2 className="text-lg font-bold text-navy">{s.title}</h2>
                  </div>
                  <p className="mt-1 text-sm text-ink">{s.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 mb-2 text-xl font-bold text-navy" data-animate="up">The confidence score, in plain English</h2>
        <p className="text-[15px] leading-relaxed text-ink" data-animate="up">
          Each Pro report carries a confidence score from 0 to 100. It isn&rsquo;t a hand-waved number: the engine
          blends three things — the <b>market structure</b> the setup is built on, the ledger&rsquo;s own <b>track
          record</b> for similar calls, and how well the <b>catalysts</b> are sourced. Because it&rsquo;s graded against
          the tape after every window, it&rsquo;s <b>calibrated</b> — the goal is that calls rated, say, 70 actually
          come true about 70% of the time. It is a calibrated estimate of how a setup may resolve, <b>not</b> a
          guarantee, a probability of profit, or a signal to trade. Always read it next to the risk rating and the
          prediction window.
        </p>

        <h2 className="mt-10 mb-4 text-xl font-bold text-navy" data-animate="up">Free vs Pro</h2>
        <div className="grid gap-4 sm:grid-cols-2" data-animate="up">
          <Card className="p-5">
            <CardContent className="px-0">
              <div className="text-sm font-bold text-navy">Snapshot — free</div>
              <p className="mt-1 text-sm text-ink">Status &amp; risk, the expected range, one chart and the thesis. The one-page read for everyone.</p>
            </CardContent>
          </Card>
          <Card className="p-5">
            <CardContent className="px-0">
              <div className="text-sm font-bold text-[#9a6700]">Pro — subscription</div>
              <p className="mt-1 text-sm text-ink">Conditional setups with R:R, the price ladder, the calibrated confidence score, the registered predictions and the full scored ledger.</p>
            </CardContent>
          </Card>
        </div>

        <h2 className="mt-10 mb-2 text-xl font-bold text-navy" data-animate="up">Stay in the loop</h2>
        <div className="mt-2 flex items-start gap-4 rounded-xl border border-line bg-white p-5" data-animate="up">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
            <Bell className="size-5" />
          </div>
          <p className="text-sm text-ink">
            <b>Follow</b> any instrument and we&rsquo;ll tell you the moment a new edition publishes. Alerts go out as
            browser/web-push notifications where your browser supports them, with email as the fallback — so you read
            the call before the session, not after.
          </p>
        </div>

        <h2 className="mt-10 mb-2 text-xl font-bold text-navy" data-animate="up">For developers &amp; AI agents</h2>
        <div className="mt-2 flex items-start gap-4 rounded-xl border border-line bg-white p-5" data-animate="up">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
            <Plug className="size-5" />
          </div>
          <p className="text-sm text-ink">
            Everything we publish can be read programmatically. Connect tools and agents — Claude, ChatGPT, Cursor and
            others — over our <b>MCP server</b>, a read-only <b>REST API</b> or the <b>OpenAPI</b> schema. The report
            catalog, free Snapshots and the public track record are keyless; full Pro analysis is gated by an OAuth
            sign-in and a subscription. <Link className="text-navy underline" href="/developers">See the developer docs →</Link>
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3" data-animate="up">
          <Button asChild>
            <Link href="/reports">Browse reports<ArrowRight data-icon="inline-end" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
