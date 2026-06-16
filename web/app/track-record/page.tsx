import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getTrackRecord } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { Hero, Note } from "@/components/ui";
import OpenCallsBrowser from "@/components/OpenCallsBrowser";
import ScoredResults from "@/components/ScoredResults";
import TrackRecordAnalytics from "@/components/TrackRecordAnalytics";
import BuyButton from "@/components/BuyButton";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Track record",
  description:
    "AssetFrame's public track record — every call registered before its window and graded against the tape: hit rate, streaks and calibration.",
  alternates: { canonical: "/track-record" },
};

const stat = (n: React.ReactNode, l: string) => (
  <div className="rounded-xl border border-line bg-white p-4">
    <div className="text-3xl font-extrabold text-navy">{n}</div>
    <div className="mt-1 text-[13px] text-muted-foreground">{l}</div>
  </div>
);

export default async function TrackRecordPage() {
  const ent = await getEntitlement();
  const tr = await getTrackRecord();
  const editions = await getCatalog();
  const registered = tr.open.reduce((a, c) => a + (c.n || 0), 0);

  // Headline mirrors the homepage hero's public-ledger strip (consistent, meaningful), with
  // the registered/scored breakdown + tables below as the deeper detail this page carries.
  const headline: [React.ReactNode, string][] = [
    [editions.length, "Reports published"],
    [tr.stats.hitRate === null ? "—" : `${tr.stats.hitRate}%`, "Directional accuracy"],
    ["100%", "Public archive"],
    [tr.stats.predictionsGraded, "Forecasts scored"],
  ];

  // The full record is a Pro benefit. Free / signed-out visitors see the public
  // headline accuracy (same numbers as the homepage) and an upgrade prompt.
  if (!ent.subscribed) {
    return (
      <>
        <Hero title="Track record" tag="Scored after the fact — the full record is part of AssetFrame Pro." />
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {headline.map(([n, l]) => stat(n, l))}
          </div>

          <Note>
            The headline accuracy above is public. The full record — every open call, each scored
            result, the per-prediction detail and the calibration table — is for AssetFrame Pro
            subscribers. Every call is still published before its outcome and graded against the tape.
          </Note>

          {ent.signedIn ? (
            <BuyButton>Subscribe {SITE.proPrice} to see the full record</BuyButton>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-in" className="rounded-lg bg-navy px-5 py-2.5 font-bold text-white hover:bg-navy-700">
                Sign in
              </Link>
              <Link href="/pricing" className="rounded-lg border border-navy px-5 py-2.5 font-bold text-navy hover:bg-tile">
                See pricing
              </Link>
            </div>
          )}
        </div>
      </>
    );
  }

  // Map symbol → asset class (from the catalog) so open calls can be filtered by asset.
  const assetByTicker: Record<string, string> = {};
  for (const e of editions) if (e.ticker) assetByTicker[e.ticker] = e.assetClass;

  return (
    <>
      <Hero title="Track record" tag="The scored-after-the-fact promise, made mechanical." />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {headline.map(([n, l]) => stat(n, l))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {editions.length} reports published · {registered} forecasts registered before their window
          {tr.stats.predictionsGraded > 0
            ? ` · ${tr.stats.predictionsGraded} scored (${tr.stats.hitRate}% hit)`
            : " · scoring begins as the first windows close"}
          {tr.stats.longestStreak > 0 ? ` · longest streak ${tr.stats.longestStreak}` : ""}.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#cdd9ea] bg-tile px-4 py-3 text-sm text-[#33415c]">
          <span>Predictions are registered <b>before</b> each window, then graded Hit / Miss / No-trigger against the tape — append-only, never re-tuned.</span>
          <Link href="/how-it-works" className="font-semibold text-navy underline underline-offset-2">How it works →</Link>
        </div>

        <TrackRecordAnalytics
          byInstrument={tr.byInstrument}
          byAssetClass={tr.byAssetClass}
          byPredictionType={tr.byPredictionType}
          byRegime={tr.byRegime}
          timeline={tr.timeline}
          calibrationCurve={tr.calibrationCurve}
          componentVsOutcome={tr.componentVsOutcome}
        />

        <h2 className="mt-8 mb-1 text-xl font-bold text-navy">Prediction calls</h2>
        <p className="mb-3 text-sm text-muted-foreground">Each call registers its predictions before the window. The badge tracks how many came true (hits/total) once the engine scores it — a majority feeds the homepage streak. Filter by asset or date, then open one to see every prediction.</p>
        <OpenCallsBrowser open={tr.open} assetClass={assetByTicker} />

        <h2 className="mt-8 mb-1 text-xl font-bold text-navy">Scored results</h2>
        {tr.scored.length === 0 ? (
          <Note>No reports scored yet — the first results land once the open calls above close. <b>Ledger starts here.</b></Note>
        ) : (
          <ScoredResults rows={tr.scored} />
        )}

        {tr.calibration && (
          <>
            <h2 className="mt-8 mb-1 text-xl font-bold text-navy">Calibration</h2>
            <p className="mb-3 text-sm text-muted-foreground">Does stated confidence track realised hit rate? It should.</p>
            <div className="overflow-x-auto">
            <table className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-white text-sm">
              <thead className="bg-tile text-navy"><tr><th className="p-3 text-left">Stated confidence</th><th className="p-3 text-left">Realised</th><th className="p-3 text-left">Reports</th></tr></thead>
              <tbody>
                {Object.entries(tr.calibration).map(([k, v]) => (
                  <tr key={k} className="border-t border-line">
                    <td className="p-3">{k}</td><td className="p-3">{v.hitRate === null ? "—" : `${v.hitRate}%`}</td><td className="p-3">{v.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
