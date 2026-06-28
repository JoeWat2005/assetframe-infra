import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Hero } from "@/components/ui";
import { getTrackRecord } from "@/lib/content";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "What AssetFrame is, what the calibrated confidence score means, whether it's financial advice, how calls are scored, how to get browser alerts and follow instruments, whether AI agents can use it, what's free vs Pro, data sources, and how billing and cancellation work.",
  alternates: { canonical: "/faq" },
};

function buildFaqs(scoredCount: number): { q: string; a: React.ReactNode; text: string }[] {
  // Self-updating: state the live scored count instead of a hard-coded "0 scored results".
  const scoredNote =
    scoredCount > 0
      ? `It currently shows ${scoredCount} scored result${scoredCount === 1 ? "" : "s"}, growing as more windows close.`
      : "The first results land as the earliest windows close.";
  return [
  {
    q: "What is AssetFrame?",
    a: <>A market-research service. For each instrument we publish a free one-page <b>Snapshot</b> and a paid <b>Pro</b> report <b>before</b> the session, then grade every call against the market afterwards and log the result in a public, append-only ledger.</>,
    text: "AssetFrame is a market-research service. For each instrument we publish a free one-page Snapshot and a paid Pro report before the session, then grade every call against the market afterwards and log the result in a public, append-only ledger.",
  },
  {
    q: "Is this financial advice?",
    a: <>No. AssetFrame is general research and decision support — not a personal recommendation and not regulated advice. We never tell you to buy or sell, and we place no trades. Markets are uncertain and you can lose money. See the <Link className="text-navy underline" href="/terms">Terms</Link>.</>,
    text: "No. AssetFrame is general research and decision support — not a personal recommendation and not regulated advice. We never tell you to buy or sell, and we place no trades. Markets are uncertain and you can lose money.",
  },
  {
    q: "How are the reports produced?",
    a: <>An AI analyst writes the thesis, scenarios and catalysts; a deterministic Python engine then compiles the price levels, the conditional setups, the confidence score and the falsifiable predictions. So the qualitative view is AI-written, but the numbers and the scoring are reproducible and auditable. <Link className="text-navy underline" href="/how-it-works">How it works →</Link></>,
    text: "An AI analyst writes the thesis, scenarios and catalysts; a deterministic Python engine then compiles the price levels, the conditional setups, the confidence score and the falsifiable predictions. The qualitative view is AI-written, but the numbers and the scoring are reproducible and auditable.",
  },
  {
    q: "What is the confidence score?",
    a: <>A 0–100 score on each Pro call. The engine blends the market structure behind the setup, the ledger&rsquo;s own track record for similar calls, and how well the catalysts are sourced — it&rsquo;s never a hand-picked number. Because every call is graded against the tape, the score is <b>calibrated</b>: the aim is that calls rated 70 come true about 70% of the time. It is an estimate, <b>not</b> a guarantee or a probability of profit, and should be read alongside the risk rating and the prediction window.</>,
    text: "A 0–100 score on each Pro call. The engine blends the market structure behind the setup, the ledger's own track record for similar calls, and how well the catalysts are sourced — it is never a hand-picked number. Because every call is graded against the tape, the score is calibrated: the aim is that calls rated 70 come true about 70% of the time. It is an estimate, not a guarantee or a probability of profit, and should be read alongside the risk rating and the prediction window.",
  },
  {
    q: "What's the difference between Snapshot and Pro?",
    a: <>Snapshot is the free one-pager: status, risk, expected range, one chart and the thesis. Pro adds conditional setups with R:R, the price ladder, the calibrated confidence score, the registered predictions and the full scored ledger.</>,
    text: "Snapshot is the free one-pager: status, risk, expected range, one chart and the thesis. Pro adds conditional setups with risk:reward, the price ladder, the calibrated confidence score, the registered predictions and the full scored ledger.",
  },
  {
    q: "How are calls scored?",
    a: <>Every Pro report registers falsifiable predictions — exact levels and an exact window — before the session. After the window closes the engine grades each one Hit / Miss / No-trigger against the price tape and appends a row that&rsquo;s never edited. The public <Link className="text-navy underline" href="/track-record">track record</Link> breaks performance down by instrument, asset class, prediction type and market regime, with a stated-vs-realised calibration curve and hit rate over time. {scoredNote}</>,
    text: `Every Pro report registers falsifiable predictions — exact levels and an exact window — before the session. After the window closes the engine grades each one Hit, Miss or No-trigger against the price tape and appends a row that is never edited. The public track record breaks performance down by instrument, asset class, prediction type and market regime, with a stated-vs-realised calibration curve and hit rate over time. ${scoredNote}`,
  },
  {
    q: "How do I get alerts and follow instruments?",
    a: <>Sign in, open any report and hit <b>Follow</b> on the instruments you care about. When a new edition publishes we&rsquo;ll notify you by browser/web-push notification where your browser supports it (turn it on from your <Link className="text-navy underline" href="/account">account</Link>), with email as the fallback.</>,
    text: "Sign in, open any report and hit Follow on the instruments you care about. When a new edition publishes we'll notify you by browser/web-push notification where your browser supports it (turn it on from your account), with email as the fallback.",
  },
  {
    q: "Can ChatGPT, Claude or other AI agents use AssetFrame?",
    a: <>Yes. We expose an <b>MCP server</b>, a read-only <b>REST API</b> and an <b>OpenAPI</b> schema, so agents and tools like Claude, ChatGPT and Cursor can read our data directly. The report catalog and public track record are keyless; reading a report needs an account (an API key over REST, an OAuth sign-in over MCP), and the full Pro analysis additionally needs a subscription. <Link className="text-navy underline" href="/developers">Developer docs →</Link></>,
    text: "Yes. We expose an MCP server, a read-only REST API and an OpenAPI schema, so agents and tools like Claude, ChatGPT and Cursor can read our data directly. The report catalog and public track record are keyless; reading a report needs an account (an API key over REST, an OAuth sign-in over MCP), and the full Pro analysis additionally needs a subscription.",
  },
  {
    q: "How much does Pro cost, and how do I pay?",
    a: <>Pro is {SITE.proPrice}. Checkout runs securely in-page — card payments are processed by Stripe and we never see your card details. You can subscribe from any report or the pricing page.</>,
    text: `Pro is ${SITE.proPrice}. Checkout runs securely in-page — card payments are processed by Stripe and we never see your card details. You can subscribe from any report or the pricing page.`,
  },
  {
    q: "How do I cancel?",
    a: <>Anytime, from <Link className="text-navy underline" href="/account/subscription">your subscription page</Link> — one click, and access continues to the end of the period you&rsquo;ve paid for.</>,
    text: "Anytime, from your subscription page — one click, and access continues to the end of the period you have paid for.",
  },
  {
    q: "Where does the data come from?",
    a: <>Official and market-data sources plus public reporting, with each report disclosing its sources and any data-quality limitations. Figures may be delayed and we label them; we never fabricate prices or news, and we never guarantee accuracy or outcomes.</>,
    text: "Official and market-data sources plus public reporting, with each report disclosing its sources and any data-quality limitations. Figures may be delayed and we label them; we never fabricate prices or news, and we never guarantee accuracy or outcomes.",
  },
  {
    q: "Which instruments do you cover?",
    a: <>Futures, FX, crypto and US single stocks. The published menu grows over time — browse the latest editions on the <Link className="text-navy underline" href="/reports">reports page</Link>.</>,
    text: "Futures, FX, cryptocurrency and US single stocks. The published menu grows over time; browse the latest editions on the reports page.",
  },
  ];
}

export default async function FaqPage() {
  const tr = await getTrackRecord();
  const faqs = buildFaqs(tr.stats.reportsScored);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.text },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Hero title="Frequently asked questions" tag="What AssetFrame is, what the confidence score means, how calls are scored, and how billing works." />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="overflow-hidden rounded-xl border border-line bg-white" data-animate="up">
          {faqs.map((f) => (
            <details key={f.q} className="group border-b border-line last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{f.a}</div>
            </details>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground" data-animate="up">
          Still stuck? Email <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
      </div>
    </>
  );
}
