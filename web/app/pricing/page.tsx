import type { Metadata } from "next";
import { PricingTable } from "@clerk/nextjs";
import { Hero, Note } from "@/components/ui";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AssetFrame pricing — a free Snapshot on every edition, or Pro at $9.99/month (3-day free trial) for conditional setups, the price ladder, the calibrated confidence score, the full scored ledger and Pro access over MCP and the API. Cancel anytime.",
  alternates: { canonical: "/pricing" },
};

const FREE = [
  "One-page Snapshot per edition",
  "Status, risk and broad expected range",
  "One chart with support/resistance",
  "Three-bullet thesis and broad scenarios",
  "Risk-window timeline",
  "Follow instruments + new-edition alerts",
  "Public track record + REST API & MCP (free tools)",
];
const PRO = [
  "Everything in the Snapshot, plus:",
  "Plain-English 30-second read + verdict",
  "Conditional long & short setups with R:R",
  "Price ladder with distances and key-level cards",
  "Calibrated confidence score (0–100), explained",
  "Registered predictions with explicit windows",
  "Scenario matrix, event-risk timeline, technicals",
  "Sentiment, positioning and options context where sourced",
  "Trade-quality scorecard and risk math",
  "Full scored outcome ledger + calibration detail",
  "Pro reports over MCP (OAuth) and the API",
  "Source audit + glossary of every chart abbreviation",
];

export default function PricingPage() {
  return (
    <>
      <Hero title="Pricing" tag="Start free. Upgrade for the full intelligence." />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
        {/* The single source of truth for plans + checkout. Clerk Billing renders the live
            price, the 3-day free trial and the subscribe CTA for new users — and the current
            plan with manage/cancel for subscribers — all in an in-page drawer. Signed-out
            visitors are prompted to sign in on selection. */}
        <PricingTable />

        {/* Non-interactive feature comparison — no prices or buttons (those live in the table
            above) so the page never shows two competing pricing widgets. */}
        <h2 className="mt-14 mb-1 text-center text-xl font-bold">What&apos;s included</h2>
        <p className="mb-5 text-center text-sm text-muted-foreground">
          Every edition ships a free Snapshot; Pro unlocks the full analysis and the scored ledger.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-white p-6">
            <div className="text-lg font-bold">AssetFrame Snapshot</div>
            <div className="mt-0.5 text-sm font-semibold text-navy">Free tier</div>
            <ul className="mt-4 space-y-2 text-sm">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-navy">✓</span>{f}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-[#9a6700] bg-white p-6">
            <div className="text-lg font-bold">AssetFrame Pro</div>
            <div className="mt-0.5 text-sm font-semibold text-[#9a6700]">Pro tier</div>
            <ul className="mt-4 space-y-2 text-sm">
              {PRO.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-[#9a6700]">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <Note>
          Pick a plan above — checkout opens right here on the page. Pro is {SITE.proPrice} with a
          3-day free trial; you won&apos;t be charged until the trial ends and can cancel in one click
          any time before then. Card payments are processed securely by Stripe — AssetFrame never sees
          your card details. Cancel whenever you like and keep Pro access to the end of the period
          you&apos;ve paid for.
        </Note>
        <p className="mt-4 text-xs text-muted-foreground">{SITE.disclaimer}</p>
      </div>
    </>
  );
}
