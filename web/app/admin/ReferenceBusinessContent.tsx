import type { LucideIcon } from "lucide-react";
import { ExternalLink, BarChart3, LineChart } from "lucide-react";
import { Note } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart, ClassBars, SplitDonut } from "@/components/admin/Charts";
import AdminActions from "./AdminActions";
import MemberSearch from "./MemberSearch";
import AdminLog from "./AdminLog";
import ProToggle from "./ProToggle";
import AdminTierToggle from "./AdminTierToggle";
import FeedbackInbox from "./FeedbackInbox";
import { SITE } from "@/site.config";
import type { AdminStats } from "@/lib/admin-stats";
import type { Entitlement } from "@/lib/entitlements";
import type { AuditRow } from "@/lib/audit";
import type { FeedbackRow } from "@/lib/feedback";

export default function ReferenceBusinessContent({
  stats,
  kpis,
  titleById,
  ent,
  auditLog,
  feedback,
}: {
  stats: AdminStats;
  kpis: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: string }[];
  titleById: Map<string, string>;
  ent: Entitlement;
  auditLog: AuditRow[];
  feedback: FeedbackRow[];
}) {
  return (
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
  );
}
