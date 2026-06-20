import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink, BarChart3, LineChart, Users, CreditCard, Percent, FileText, Download, DollarSign, Cpu } from "lucide-react";
import { getAllEditions, getHiddenEditions } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { getAdminStats } from "@/lib/admin-stats";
import { getEngineState, getGenerationRequests, getEngineRuns, getEngineCommands } from "@/lib/engine";
import { getEngineAssets } from "@/lib/engine-assets";
import { Badge, Hero, Note } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart, ClassBars, SplitDonut } from "@/components/admin/Charts";
import AdminActions from "./AdminActions";
import MemberSearch from "./MemberSearch";
import AdminLog from "./AdminLog";
import ProToggle from "./ProToggle";
import AdminTierToggle from "./AdminTierToggle";
import EditionsBrowser from "./EditionsBrowser";
import ApproveButton from "./ApproveButton";
import PauseToggle from "./PauseToggle";
import GenerateForm from "./GenerateForm";
import BoxControls from "./BoxControls";
import AssetManager from "./AssetManager";
import { RequestQueue, RunLog, CommandLog } from "./EnginePanels";
import { getAuditLog } from "@/lib/audit";
import { getFeedback } from "@/lib/feedback";
import FeedbackInbox from "./FeedbackInbox";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  if (!ent.admin) redirect("/account");

  const [stats, catalog, pending, auditLog, feedback, engineState, genRequests, engineRuns, engineCommands, engineAssets] = await Promise.all([
    getAdminStats(), getAllEditions(), getHiddenEditions(), getAuditLog(), getFeedback(),
    getEngineState(), getGenerationRequests(), getEngineRuns(), getEngineCommands(), getEngineAssets(),
  ]);
  const titleById = new Map(catalog.map((e) => [`${e.date}/${e.slug}`, e.instrument]));

  // Distinct instruments (by slug) for the Generate picker — one row per asset the engine can
  // regenerate, taking the newest edition's instrument/ticker as the label.
  const assetMap = new Map<string, { slug: string; instrument: string; ticker: string }>();
  for (const e of catalog) {
    if (!assetMap.has(e.slug)) assetMap.set(e.slug, { slug: e.slug, instrument: e.instrument, ticker: e.ticker });
  }
  const assets = [...assetMap.values()].sort((a, b) => a.instrument.localeCompare(b.instrument));

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
      <Hero title="Admin" tag="Operations overview — visible to admins only." />
      <div className="mx-auto max-w-6xl px-5 py-8">
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

        {/* Preview tier — admins get Pro free; switch to Free to see the non-subscriber view */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Preview tier</CardTitle>
            <CardDescription>You get Pro for free as an admin — switch to Free to see what non-subscribers see (your admin access is unaffected).</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminTierToggle current={ent.adminTier === "free" ? "free" : "pro"} />
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                <p className="px-6 pb-2 text-sm text-muted-foreground">No members yet (or Clerk not configured).</p>
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

        {/* Manage access */}
        <AdminActions />

        {/* Member search */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Find a member</CardTitle>
            <CardDescription>Search by email or name, then grant or revoke Pro inline.</CardDescription>
          </CardHeader>
          <CardContent><MemberSearch /></CardContent>
        </Card>

        {/* Activity log */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Activity log</CardTitle>
            <CardDescription>Admin and billing actions, most recent first — searchable.</CardDescription>
          </CardHeader>
          <CardContent><AdminLog rows={auditLog} /></CardContent>
        </Card>

        {/* Feedback inbox */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Feedback &amp; feature requests</CardTitle>
            <CardDescription>Submissions from the public form — triage by changing each one&rsquo;s status.</CardDescription>
          </CardHeader>
          <CardContent><FeedbackInbox rows={feedback} /></CardContent>
        </Card>

        {/* External dashboards */}
        <Card className="mt-4">
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

        {/* Engine — control plane for the Oracle Cloud VM that runs the Python engine. The VM has
            no inbound ports, so everything here is mediated through Neon (we enqueue; it polls). */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Cpu className="size-4" />Engine
            </CardTitle>
            <CardDescription>
              Your report generator runs on a cloud box that checks in every ~30s. The daily batch fires
              at <b>05:00 UTC</b> unless automation is paused. Everything below controls or inspects it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Status — one clear, plain-English row. */}
            <div className="rounded-xl border border-line bg-tile/40 px-4 py-3">
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
                  Daily automation:{" "}
                  <b className={engineState.automationPaused ? "text-[#9a6700]" : "text-[#1a7f37]"}>
                    {engineState.automationPaused ? "Paused" : "Active"}
                  </b>
                </span>
                {engineState.currentRunId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-bold text-[#9a6700]">
                    <span className="size-2 animate-pulse rounded-full bg-[#9a6700]" />
                    Running: {engineState.currentRunId}
                  </span>
                )}
                <span className="ml-auto"><PauseToggle paused={engineState.automationPaused} /></span>
              </div>
              {!engineState.online && (
                <p className="mt-2 text-xs text-[#cf222e]">
                  The box hasn&rsquo;t checked in — scheduled and manual runs won&rsquo;t execute until it&rsquo;s back.
                  Use <b>Restart poller</b> or <b>Pull + restart</b> below.
                </p>
              )}
            </div>

            {/* 1. Generate */}
            <div>
              <h3 className="text-sm font-bold text-navy">1 · Generate reports</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Queue a run now — the whole due batch, or hand-pick assets. New editions land <b>hidden</b> for
                your approval (see <b>Pending approval</b> below). The daily 05:00 run does this automatically.
              </p>
              <GenerateForm assets={assets} />
            </div>

            {/* 2. Box control — allow-listed commands the OCI poller claims + runs (engine_commands). */}
            <div className="border-t border-line pt-5">
              <h3 className="text-sm font-bold text-navy">2 · Operate the box <span className="font-normal text-muted-foreground">(maintenance)</span></h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Direct control of the cloud instance: <b>Re-run publish</b> recovers a run that generated but
                didn&rsquo;t publish · <b>Fetch logs</b> pulls recent output · <b>Pull + restart</b> deploys the
                latest code · <b>Restart poller</b> bounces it · <b>Set config</b> tweaks an allow-listed setting.
                Each runs on the box&rsquo;s next ~30s poll; watch the <b>Box command log</b> below for results.
              </p>
              <BoxControls />
            </div>

            {/* Command reference — what each control does. */}
            <details className="border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-bold text-navy">Command reference — what each control does</summary>
              <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {[
                  ["Generate → All due / Pick", "Queue a run now for every due asset, or a hand-picked set. New editions land per their publish policy."],
                  ["Pause / Resume automation", "Stop or restart the automatic 05:00 UTC daily run. Manual runs still work while paused."],
                  ["Re-run publish", "Re-runs export → R2 → Neon for a run that generated locally but didn’t publish (e.g. a transient error)."],
                  ["Fetch logs", "Pulls the box’s recent poller output into the Box command log below."],
                  ["Pull + restart", "git pull the latest code on the box + reinstall deps, then restart onto it."],
                  ["Restart poller", "Gracefully bounce the box process (picks up .env / config changes)."],
                  ["Set config", "Write an allow-listed env setting on the box (applies after a restart)."],
                  ["Score now", "Grade any closed prediction windows into the ledger immediately (no new reports)."],
                  ["Reset ledger", "Truncate the box’s outcome ledger to empty — a fresh track-record source. Pair with clearing Neon."],
                  ["Clear reports", "Wipe the box’s working dirs (reports/data/content/runs) — a full system refresh, no SSH needed."],
                  ["Asset universe", "Add / enable / disable the instruments the engine generates, plus the global approval toggle. Auto-syncs to the box."],
                  ["Approve / Unpublish", "Publish a hidden edition to the public site, or hide a live one (per-report, in Pending approval below)."],
                ].map(([t, d]) => (
                  <div key={t}>
                    <dt className="text-sm font-semibold text-navy">{t}</dt>
                    <dd className="text-xs text-muted-foreground">{d}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </CardContent>
        </Card>

        {/* Asset universe — what the engine generates reports for (dashboard-editable). */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Asset universe</CardTitle>
            <CardDescription>
              What the engine generates reports for. Add or enable/disable instruments and set whether new
              reports need your approval. Edited here and auto-synced to the box — validated before it applies,
              so a bad entry can never break generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssetManager assets={engineAssets} />
          </CardContent>
        </Card>

        {/* Queue + recent runs (the OC instance logs) */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generation queue</CardTitle>
              <CardDescription>Recent requests — cancel a queued or running one to stop it at the next safe point.</CardDescription>
            </CardHeader>
            <CardContent className={genRequests.length === 0 ? undefined : "px-0"}>
              <RequestQueue rows={genRequests} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent engine runs</CardTitle>
              <CardDescription>Run history from the cloud instance — expand a row for its error / log excerpt.</CardDescription>
            </CardHeader>
            <CardContent className={engineRuns.length === 0 ? undefined : "px-0"}>
              <RunLog rows={engineRuns} />
            </CardContent>
          </Card>
        </div>

        {/* Box command log — outcome of the box-control commands (restart/pull/maintenance/logs/config). */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Box command log</CardTitle>
            <CardDescription>Recent box-control commands and their result — expand a row for the captured output (e.g. fetched logs).</CardDescription>
          </CardHeader>
          <CardContent className={engineCommands.length === 0 ? undefined : "px-0"}>
            <CommandLog rows={engineCommands} />
          </CardContent>
        </Card>

        {/* Pending approval — editions generated hidden by the engine's approval gate, awaiting publish */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Pending approval</CardTitle>
            <CardDescription>
              Editions generated behind the engine&rsquo;s approval gate (hidden). Preview each one, then <b>Approve</b> to publish it to the public site, sitemap and reader.
            </CardDescription>
          </CardHeader>
          <CardContent className={pending.length === 0 ? undefined : "px-0"}>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No editions awaiting approval.</p>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {pending.map((e) => {
                  const id = `${e.date}/${e.slug}`;
                  return (
                    <div key={id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <b className="truncate">{e.instrument}</b>
                          <span className="text-muted-foreground">{e.ticker}</span>
                          {e.status && <Badge label={e.status} kind="status" />}
                          {e.risk && <Badge label={e.risk} kind="risk" />}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {e.reportDate} · prediction window to {e.windowEnd || "—"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <a href={`/reports/${id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink data-icon="inline-start" />Preview
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <a href={`/api/report/${id}/free.pdf`} target="_blank" rel="noopener noreferrer">
                            <FileText data-icon="inline-start" />PDF
                          </a>
                        </Button>
                        <ApproveButton id={id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <h2 className="mt-6 mb-1 text-xl font-bold text-navy">Editions</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Search for an edition and toggle it to <b>Hidden</b> to unpublish it from the public site, sitemap and reader — the files stay in R2 and it can be restored.
        </p>
        <EditionsBrowser editions={catalog} />
      </div>
    </>
  );
}
