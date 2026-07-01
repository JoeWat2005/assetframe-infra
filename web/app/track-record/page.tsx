import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getTrackRecord } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { Hero, Note } from "@/components/ui";
import OpenCallsBrowser from "@/components/OpenCallsBrowser";
import ScoredResults from "@/components/ScoredResults";
import TrackRecordAnalytics from "@/components/TrackRecordAnalytics";
import TrackRecordSummary from "@/components/TrackRecordSummary";
import BuyButton from "@/components/BuyButton";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Track record",
  description:
    "AssetFrame's public track record — every call registered before its window and graded against the tape: hit rate, streaks and calibration.",
  alternates: { canonical: "/track-record" },
};


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

  // The PROOF is public — the headline accuracy, the registered open calls, a sample of recent
  // scored results and the calibration table are visible to everyone so prospects can verify the
  // "scored after the fact" claim before paying. The deep performance ANALYTICS and the full
  // browsable scored ledger remain a Pro benefit (gated inline below).

  // Map symbol → asset class (from the catalog) so open calls can be filtered by asset.
  const assetByTicker: Record<string, string> = {};
  for (const e of editions) if (e.ticker) assetByTicker[e.ticker] = e.assetClass;
  // Free visitors see the 5 most-recent scored results as proof; Pro sees the full ledger.
  const recentScored = [...tr.scored]
    .sort((a, b) => String(b.windowEnd ?? "").localeCompare(String(a.windowEnd ?? "")))
    .slice(0, 5);

  return (
    <>
      <Hero title="Track record" tag="The scored-after-the-fact promise, made mechanical." />
      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* DaisyUI stats block (used alongside shadcn) — brand-coloured: structure from daisy, colour from the palette. */}
        <div className="daisy-stats daisy-stats-vertical w-full overflow-hidden rounded-xl border border-line bg-white shadow-sm sm:daisy-stats-horizontal">
          {headline.map(([n, l]) => (
            <div key={l} className="daisy-stat">
              <div className="daisy-stat-value text-3xl font-extrabold text-navy">{n}</div>
              <div className="daisy-stat-title mt-1 text-[13px] font-normal text-muted-foreground">{l}</div>
            </div>
          ))}
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

        {/* Free-tier micro-dashboard: per-class / per-cadence / per-instrument hit rates + charts,
            visible to everyone as the public proof (the deeper analytics below stay Pro-gated). */}
        <TrackRecordSummary
          byAssetClass={tr.byAssetClass}
          byCadence={tr.byCadence}
          byInstrument={tr.byInstrument}
          cumulativeHitRate={tr.stats.hitRate}
          currentStreak={tr.stats.currentStreak}
        />

        {/* Full performance analytics are a Pro benefit. Free visitors still get the proof below
            (open calls, recent scored results, calibration) plus a clear, honest upsell. */}
        {ent.subscribed ? (
          <TrackRecordAnalytics
            byInstrument={tr.byInstrument}
            byAssetClass={tr.byAssetClass}
            byPredictionType={tr.byPredictionType}
            byRegime={tr.byRegime}
            byHorizon={tr.byHorizon}
            byCadence={tr.byCadence}
            timeline={tr.timeline}
            calibrationCurve={tr.calibrationCurve}
            componentVsOutcome={tr.componentVsOutcome}
          />
        ) : tr.stats.predictionsGraded > 0 ? (
          // Only upsell "full performance analytics" once there's something to unlock — before any
          // window has closed the analytics render empty, so the banner would over-promise.
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#9a6700]/40 bg-[#fff7e6] px-4 py-3 text-sm">
            <span className="text-[#7a5200]">
              The proof is public — registered open calls, recent scored results and calibration are
              all below. <b>AssetFrame Pro</b> adds the full performance analytics (by instrument,
              asset class, prediction type and regime, the calibration curve and cumulative timeline)
              and the complete browsable ledger.
            </span>
            {ent.signedIn ? (
              <BuyButton>Unlock Pro {SITE.proPrice}</BuyButton>
            ) : (
              <Link href="/pricing" className="shrink-0 rounded-lg bg-navy px-4 py-2 font-bold text-white hover:bg-navy-700">See Pro</Link>
            )}
          </div>
        ) : null}

        <h2 className="mt-8 mb-1 text-xl font-bold text-navy">Prediction calls</h2>
        <p className="mb-3 text-sm text-muted-foreground">Each call registers its predictions before the window. The badge tracks how many came true (hits/total) once the engine scores it — a majority feeds the homepage streak. Filter by asset or date, then open one to see every prediction.</p>
        <OpenCallsBrowser open={tr.open} assetClass={assetByTicker} />

        <h2 className="mt-8 mb-1 text-xl font-bold text-navy">Scored results</h2>
        {tr.scored.length === 0 ? (
          <Note>No reports scored yet — the first results land once the open calls above close. <b>Ledger starts here.</b></Note>
        ) : ent.subscribed ? (
          <ScoredResults rows={tr.scored} />
        ) : (
          <>
            {/* Free: a sample of the most recent scored results — the proof. Pro = the full ledger. */}
            <ScoredResults rows={recentScored} />
            <p className="mt-2 text-sm text-muted-foreground">
              Showing the {recentScored.length} most recent of {tr.scored.length} scored{" "}
              {tr.scored.length === 1 ? "result" : "results"}.{" "}
              <Link href="/pricing" className="font-semibold text-navy underline underline-offset-2">
                Unlock the full scored ledger with Pro →
              </Link>
            </p>
          </>
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
