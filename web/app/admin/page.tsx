import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink, BarChart3, LineChart, Users, CreditCard, Percent, FileText, Download, DollarSign } from "lucide-react";
import { getAllEditions, getHiddenEditions } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { getAdminStats } from "@/lib/admin-stats";
import { getEngineState, getGenerationRequests, getEngineRuns, getEngineCommands, getBacktestResults, getBacktestPredictions } from "@/lib/engine";
import { getEngineAssets } from "@/lib/engine-assets";
import { Hero, Note } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart, ClassBars, SplitDonut } from "@/components/admin/Charts";
import AdminActions from "./AdminActions";
import MemberSearch from "./MemberSearch";
import AdminLog from "./AdminLog";
import ProToggle from "./ProToggle";
import AdminTierToggle from "./AdminTierToggle";
import EditionsBrowser from "./EditionsBrowser";
import PauseToggle from "./PauseToggle";
import GenerateForm from "./GenerateForm";
import BoxControls from "./BoxControls";
import AssetManager from "./AssetManager";
import PendingApprovalList from "./PendingApprovalList";
import OperatorManual from "./OperatorManual";
import BacktestResults from "./BacktestResults";
import CollapsibleSection from "./CollapsibleSection";
import { RequestQueue, RunLog, CommandLog } from "./EnginePanels";
import { getAuditLog } from "@/lib/audit";
import { getFeedback } from "@/lib/feedback";
import FeedbackInbox from "./FeedbackInbox";
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
        <div className={`rounded-xl px-4 py-3 ring-1 ${engineState.online ? "bg-card ring-foreground/10" : "bg-[#fff5f5] ring-[#cf222e]/40"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                engineState.online ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#ffebe9] text-[#cf222e]"
              }`}
            >
              <span className={`size-2 rounded-full ${engineState.online ? "bg-[#1a7f37]" : "bg-[#cf222e]"}`} />
              {engineState.online ? "Online" : "Offline"}
            </span>
            <span className="text-sm text-muted-foreground">
              Last check-in:{" "}
              <b className="text-navy">
                {engineState.lastHeartbeatAt ? `${engineState.lastHeartbeatAt.replace("T", " ").slice(0, 16)} UTC` : "never"}
              </b>
            </span>
            <span className="text-sm text-muted-foreground">
              Scheduled automation:{" "}
              <b className={engineState.automationPaused ? "text-[#9a6700]" : "text-[#1a7f37]"}>
                {engineState.automationPaused ? "Paused" : "Active"}
              </b>
            </span>
            {engineState.currentRunId && (engineState.online ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-bold text-[#9a6700]">
                <span className="size-2 animate-pulse rounded-full bg-[#9a6700]" />
                Running: {engineState.currentRunId}
              </span>
            ) : (
              // The box hasn't heartbeat within the window — current_run_id is stale (the run can't
              // still be in progress if the engine is offline), so don't show a live "Running" badge.
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tile px-3 py-1 text-xs font-bold text-[#57606a]">
                <span className="size-2 rounded-full bg-[#57606a]" />
                Run {engineState.currentRunId} — offline since {engineState.lastHeartbeatAt ? `${engineState.lastHeartbeatAt.replace("T", " ").slice(0, 16)} UTC` : "never"}
              </span>
            ))}
            <span className="ml-auto"><PauseToggle paused={engineState.automationPaused} /></span>
          </div>
          {!engineState.online && (
            <p className="mt-2 text-xs text-[#cf222e]">
              The box hasn&rsquo;t checked in — scheduled and manual runs won&rsquo;t execute until it&rsquo;s back.
              Open the manual&rsquo;s Troubleshooting, or use <b>Restart engine</b> in <b>Operate the box</b> below.
            </p>
          )}
        </div>

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
        <Card id="sec-backtest" className="mt-4 scroll-mt-24 border-2 border-dashed border-[#bf8700]/40 bg-[#fff7e6]/30">
          <CardHeader>
            <CardTitle className="text-base text-[#9a6700]">Sandbox backtester</CardTitle>
            <CardDescription>
              Generate + score assets <b>backdated</b> to a closed window in an <b>isolated sandbox</b> — test
              scoring and seed the track record safely. Nothing here touches the public ledger, editions, R2 or
              track record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Settings are a compact 1/3 column; the results table gets the wider 2/3 so its
                instrument/thesis/predictions columns aren't cramped. */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="mb-2 text-sm font-bold text-[#9a6700]">Run a backtest</h3>
                <GenerateForm assets={assets} mode="backtest" />
              </div>
              <div className="lg:col-span-2 lg:border-l lg:border-[#bf8700]/30 lg:pl-5">
                <h3 className="mb-2 text-sm font-bold text-[#9a6700]">Results</h3>
                <BacktestResults rows={backtestResults} predictions={backtestPredictions} />
              </div>
            </div>
          </CardContent>
        </Card>

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
          <div className="flex flex-col gap-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Business metrics</div>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {kpis.map((k) => (
                <Card key={k.label}>
                  <CardContent className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <k.icon className="size-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span>
                    </div>
                    <div className="text-2xl font-extrabold text-navy">{k.value}</div>
                    {k.sub && <div className="text-[11px] text-muted-foreground">{k.sub}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Preview tier */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview tier</CardTitle>
                <CardDescription>You get Pro for free as an admin — switch to Free to see what non-subscribers see (your admin access is unaffected).</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminTierToggle current={ent.adminTier === "free" ? "free" : "pro"} />
              </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New members</CardTitle>
                  <CardDescription>Sign-ups over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart data={stats.signups30d} label="Sign-ups" color="#0b2545" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pro downloads</CardTitle>
                  <CardDescription>Pro report fetches over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart data={stats.downloads30d} label="Downloads" color="#9a6700" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Free vs Pro</CardTitle>
                  <CardDescription>Membership split{stats.membersCapped ? " (newest 100)" : ""}</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.members > 0 ? (
                    <SplitDonut pro={stats.subscribers} free={Math.max(0, stats.members - stats.subscribers)} />
                  ) : (
                    <p className="py-12 text-center text-sm text-muted-foreground">No members yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Editions by asset class</CardTitle>
                  <CardDescription>Published coverage</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.editionsByClass.length > 0 ? (
                    <ClassBars data={stats.editionsByClass} />
                  ) : (
                    <p className="py-12 text-center text-sm text-muted-foreground">No editions yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top reports + Recent members */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top reports by downloads</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  {stats.topReports.length === 0 ? (
                    <p className="px-6 pb-2 text-sm text-muted-foreground">No downloads logged yet.</p>
                  ) : (
                    <div className="divide-y divide-line border-t border-line">
                      {stats.topReports.map((r) => (
                        <div key={r.reportId} className="flex items-center justify-between px-6 py-2.5 text-sm">
                          <span className="truncate">{titleById.get(r.reportId) ?? r.reportId}</span>
                          <span className="font-semibold text-navy">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent members</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  {stats.recent.length === 0 ? (
                    <p className="px-6 pb-2 text-sm text-muted-foreground">No members yet.</p>
                  ) : (
                    <div className="divide-y divide-line border-t border-line">
                      {stats.recent.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
                          <span className="truncate">{m.email}</span>
                          <ProToggle email={m.email} subscribed={m.subscribed} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Members &amp; access</div>
            {/* Manage access */}
            <AdminActions />

            {/* Member search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Find a member</CardTitle>
                <CardDescription>Search by email or name, then grant or revoke Pro inline. (Comp toggle only — paid subscriptions live in Clerk.)</CardDescription>
              </CardHeader>
              <CardContent><MemberSearch /></CardContent>
            </Card>

            {/* Activity log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity log</CardTitle>
                <CardDescription>Admin and billing actions, most recent first — searchable.</CardDescription>
              </CardHeader>
              <CardContent><AdminLog rows={auditLog} /></CardContent>
            </Card>

            {/* Feedback inbox */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Feedback &amp; feature requests</CardTitle>
                <CardDescription>Submissions from the public form — triage by changing each one&rsquo;s status.</CardDescription>
              </CardHeader>
              <CardContent><FeedbackInbox rows={feedback} /></CardContent>
            </Card>

            {/* External dashboards */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traffic &amp; performance</CardTitle>
                <CardDescription>Visitors, Core Web Vitals and analytics live in these dashboards.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href={SITE.analyticsUrl} target="_blank" rel="noopener noreferrer">
                    <BarChart3 data-icon="inline-start" />Vercel — Analytics &amp; Speed<ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={SITE.gaUrl} target="_blank" rel="noopener noreferrer">
                    <LineChart data-icon="inline-start" />Google Analytics<ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Note>
              The member count + recent sign-ups come from Clerk (the newest 100 accounts feed the charts);
              the Pro-subscriber count and MRR are derived from the same accounts&rsquo; subscription flag.
              Full member and subscription management (refunds, cancellations, bans, roles) lives in the{" "}
              <b>Clerk</b> dashboard.
            </Note>
          </div>
        </CollapsibleSection>
      </div>
    </>
  );
}
