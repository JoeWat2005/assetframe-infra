import type { Metadata } from "next";
import { Btn, Hero, Note } from "@/components/ui";
import BuyButton from "@/components/BuyButton";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AssetFrame pricing — a free Snapshot on every edition, or Pro at £9.99/month for conditional setups, the price ladder, the calibrated confidence score, the full scored ledger and Pro access over MCP and the API. Cancel anytime.",
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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-white p-6">
            <div className="text-xl font-bold">AssetFrame Snapshot</div>
            <div className="mt-1 font-bold text-navy">Free</div>
            <ul className="mt-4 space-y-2 text-sm">
              {FREE.map((f) => <li key={f} className="flex gap-2"><span className="text-navy">✓</span>{f}</li>)}
            </ul>
            <div className="mt-5"><Btn href="/reports" variant="primary">Browse free editions</Btn></div>
          </div>
          <div className="rounded-xl border-2 border-[#9a6700] bg-white p-6">
            <div className="text-xl font-bold">AssetFrame Pro</div>
            <div className="mt-1 font-bold text-[#9a6700]">{SITE.proPrice} · cancel anytime</div>
            <ul className="mt-4 space-y-2 text-sm">
              {PRO.map((f) => <li key={f} className="flex gap-2"><span className="text-[#9a6700]">✓</span>{f}</li>)}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <BuyButton>Subscribe {SITE.proPrice}</BuyButton>
              <Btn href="/account" sm>Already subscribed?</Btn>
            </div>
          </div>
        </div>
        <Note>
          Checkout opens right here on the page. After paying you&apos;re subscribed automatically against
          your signed-in account — open any Pro report from <b>Reports</b> or your <b>Account</b>. Pro is{" "}
          {SITE.proPrice}, billed through our merchant of record; cancel in one click anytime and keep access to the
          end of the period you&apos;ve paid for.
        </Note>
        <p className="mt-4 text-xs text-muted-foreground" data-animate="up">{SITE.disclaimer}</p>
      </div>
    </>
  );
}
