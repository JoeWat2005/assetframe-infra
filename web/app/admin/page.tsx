import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, CreditCard, Percent, FileText, Download, DollarSign } from "lucide-react";
import { getAllEditions, getHiddenEditions } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { getAdminStats } from "@/lib/admin-stats";
import { getEngineState, getGenerationRequests, getEngineRuns, getEngineCommands, getBacktestResults, getBacktestPredictions } from "@/lib/engine";
import { getEngineAssets } from "@/lib/engine-assets";
import { Hero } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import EditionsBrowser from "./EditionsBrowser";
import GenerateForm from "./GenerateForm";
import BoxControls from "./BoxControls";
import AssetManager from "./AssetManager";
import PendingApprovalList from "./PendingApprovalList";
import OperatorManual from "./OperatorManual";
import CollapsibleSection from "./CollapsibleSection";
import { RequestQueue, RunLog, CommandLog } from "./EnginePanels";
import { getAuditLog } from "@/lib/audit";
import { getFeedback } from "@/lib/feedback";
import EngineStatusBar from "./EngineStatusBar";
import BacktestSection from "./BacktestSection";
import ReferenceBusinessContent from "./ReferenceBusinessContent";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// The admin page is the engine control plane, reworked around the Operator manual (top): live
// status → manual → the numbered daily-loop spine (1 Asset universe → 2 Generate/backdate/score →
// 3 Approve) → advanced "Operate the box" (collapsed) → a "Reference" zone (collapsed) holding the
// business/member/traffic cards. Pre-launch attention belongs on the engine + track record, so the
// growth dashboards are demoted below the fold. Data fetching is unchanged.
export default async function AdminPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  if (!ent.admin) redirect("/account");

  const [stats, catalog, pending, auditLog, feedback, engineState, genRequests, engineRuns, engineCommands, engineAssets, backtestResults, backtestPredictions] = await Promise.all([
    getAdminStats(), getAllEditions(), getHiddenEditions(), getAuditLog(), getFeedback(),
    getEngineState(), getGenerationRequests(), getEngineRuns(), getEngineCommands(), getEngineAssets(), getBacktestResults(), getBacktestPredictions(),
  ]);
  const titleById = new Map(catalog.map((e) => [`${e.date}/${e.slug}`, e.instrument]));

  // The Generate picker uses the ASSET UNIVERSE (engine_assets, enabled), NOT the published
  // catalog — so you can generate an instrument before its first edition exists. The value is the
  // engine asset id ("btc"), which requestGeneration validates + the engine runs as `--asset btc`.
  // Pick several to generate them together (the engine runs assets in parallel with 4 workers).
  const assets = engineAssets
    .filter((a) => a.enabled)
    .map((a) => ({ slug: a.id, instrument: a.instrument, ticker: a.ticker }))
    .sort((a, b) => a.instrument.localeCompare(b.instrument));

  const priceNum = parseFloat((SITE.proPrice.match(/[\d.]+/) || ["0"])[0]) || 0;
  const mrr = stats.subscribers * priceNum;
  // Both members and subscribers come from Clerk (subscribers = the publicMetadata.subscribed
  // flag Clerk Billing mirrors). Clamp so the count can never show an impossible >100% conversion.
  const conversion = stats.members ? Math.min(100, Math.round((stats.subscribers / stats.members) * 1000) / 10) : 0;

  const kpis: { icon: typeof Users; label: string; value: React.ReactNode; sub?: string }[] = [
    { icon: Users, label: "Members", value: stats.members, sub: stats.membersCapped ? "newest 100 in charts" : undefined },
    { icon: CreditCard, label: "Pro subscribers", value: stats.subscribers },
    { icon: Percent, label: "Conversion", value: `${conversion}%` },
    { icon: FileText, label: "Editions", value: catalog.length },
    { icon: Download, label: "Pro downloads", value: stats.downloadsTotal },
    { icon: DollarSign, label: "Est. MRR", value: `$${mrr.toFixed(2)}` },
  ];

  return (
    <>
      <Hero title="Admin" tag="Engine control plane — visible to admins only." />
      <div className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
        {/* === Engine status bar (promoted to the top so it's the first thing you see) === */}
        <EngineStatusBar engineState={engineState} />

        {/* === Operator manual — the spine of the page (open by default on first visit) === */}
        <OperatorManual />

        {/* === Engine activity — generation queue + recent runs, promoted to the top so you
            see what the engine has been up to immediately. === */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generation queue</CardTitle>
              <CardDescription>Runs requested (manual or scheduled). Cancel a queued or running one to stop it at the next safe point.</CardDescription>
            </CardHeader>
            <CardContent className={genRequests.length === 0 ? undefined : "px-0"}>
              <RequestQueue rows={genRequests} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent engine runs</CardTitle>
              <CardDescription>What the engine actually did, newest first — expand a row to see its log or error.</CardDescription>
            </CardHeader>
            <CardContent className={engineRuns.length === 0 ? undefined : "px-0"}>
              <RunLog rows={engineRuns} />
            </CardContent>
          </Card>
        </div>

        {/* === Asset universe — drives the schedule (cadence + chart intervals per asset) === */}
        <Card id="sec-assets" className="mt-4 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base">Asset universe</CardTitle>
            <CardDescription>
              The instruments the engine writes reports for. <b>+ Add asset</b> to add one (fill the Basics —
              the rest defaults from its asset class), or <b>Edit</b> a row to change it. Make sure at least one
              is <b>Enabled</b>. Changes save straight to the engine — validated first, so a bad entry can&rsquo;t
              break generation; <b>Check schedule</b> shows what will run next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssetManager assets={engineAssets} />
          </CardContent>
        </Card>

        {/* === Sandbox backtester — settings (left) + results (right) in ONE card. Generation and
            scoring are now driven by the per-asset schedule + this isolated backtester; the old
            "Generate & score" / "Score now" / seed-the-track-record controls are gone. === */}
        <BacktestSection assets={assets} backtestResults={backtestResults} backtestPredictions={backtestPredictions} />

        {/* === Approve to publish === */}
        <Card id="sec-approve" className="mt-4 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base">Approve to publish</CardTitle>
            <CardDescription>
              Editions the engine generated <b>hidden</b> behind its approval gate. Preview each one, then{" "}
              <b>Approve</b> to publish it to the public site, sitemap and reader. (Independent of scoring —
              either order is fine.)
            </CardDescription>
          </CardHeader>
          <CardContent className={pending.length === 0 ? undefined : "px-0"}>
            <PendingApprovalList pending={pending} />
          </CardContent>
        </Card>

        {/* Editions browser — search published editions + unpublish (part of step 3). */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">All editions</CardTitle>
            <CardDescription>
              Search published editions; toggle one to <b>Hidden</b> to unpublish it from the public site,
              sitemap and reader — the files stay in R2 and it can be restored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditionsBrowser editions={catalog} />
          </CardContent>
        </Card>

        {/* === Operate the box — advanced recovery / deploy controls + the command log (collapsed). === */}
        <CollapsibleSection
          id="sec-box"
          title="Operate the box (advanced)"
          description="Hands-on controls for the cloud box — only needed when something's stuck or you're deploying. Grouped into Recover & inspect, Deploy & restart, and Change a setting, plus a red Danger zone and the box command log below."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Left: command inputs (recover/deploy/set-config/danger + a manual-generate override). */}
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Direct control of the cloud instance. Each command runs on the box&rsquo;s next ~30s poll; watch
                the <b>Box command log</b> on the right for results. The red <b>Danger zone</b> holds
                irreversible resets — see the manual before using them.
              </p>
              <details className="rounded-lg border border-line bg-tile/30 px-3 py-2.5">
                <summary className="cursor-pointer text-xs font-semibold text-navy">
                  Manual generate (override the schedule)
                </summary>
                <div className="mt-3">
                  <GenerateForm assets={assets} mode="queue" />
                </div>
              </details>
              <BoxControls />
            </div>
            {/* Right: the box command log. */}
            <div>
              <h3 className="text-sm font-bold text-navy">Box command log</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Recent box-control commands and their result — expand a row for the captured output (e.g. fetched logs).
              </p>
              <div className={engineCommands.length === 0 ? undefined : "-mx-4 sm:-mx-0"}>
                <CommandLog rows={engineCommands} />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* === Reference — growth, members & traffic (demoted, collapsed). === */}
        <CollapsibleSection
          title="Reference — growth, members & traffic"
          description="Business metrics, charts, member admin, feedback and analytics. Demoted below the engine since pre-launch focus is the track record."
        >
          <ReferenceBusinessContent stats={stats} kpis={kpis} titleById={titleById} ent={ent} auditLog={auditLog} feedback={feedback} />
        </CollapsibleSection>
      </div>
    </>
  );
}
