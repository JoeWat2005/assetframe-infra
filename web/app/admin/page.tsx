import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink, BarChart3, LineChart, Users, CreditCard, Percent, FileText, Download, PoundSterling } from "lucide-react";
import { getCatalog } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { getAdminStats } from "@/lib/admin-stats";
import { Hero, Note } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart, ClassBars, SplitDonut } from "@/components/admin/Charts";
import AdminActions from "./AdminActions";
import MemberSearch from "./MemberSearch";
import AdminLog from "./AdminLog";
import ProToggle from "./ProToggle";
import { getAuditLog } from "@/lib/audit";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  if (!ent.admin) redirect("/account");

  const [stats, catalog, auditLog] = await Promise.all([getAdminStats(), getCatalog(), getAuditLog()]);
  const titleById = new Map(catalog.map((e) => [`${e.date}/${e.slug}`, e.instrument]));

  const priceNum = parseFloat((SITE.proPrice.match(/[\d.]+/) || ["0"])[0]) || 0;
  const mrr = stats.subscribers * priceNum;
  const conversion = stats.members ? Math.round((stats.subscribers / stats.members) * 1000) / 10 : 0;

  const kpis: { icon: typeof Users; label: string; value: React.ReactNode; sub?: string }[] = [
    { icon: Users, label: "Members", value: stats.members, sub: stats.membersCapped ? "scan capped at 500" : undefined },
    { icon: CreditCard, label: "Pro subscribers", value: stats.subscribers },
    { icon: Percent, label: "Conversion", value: `${conversion}%` },
    { icon: FileText, label: "Editions", value: catalog.length },
    { icon: Download, label: "Pro downloads", value: stats.downloadsTotal },
    { icon: PoundSterling, label: "Est. MRR", value: `£${mrr.toFixed(2)}` },
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
              <CardDescription>Membership split{stats.membersCapped ? " (first 500)" : ""}</CardDescription>
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
          Subscriber and member numbers come from Clerk (scanned up to 500 accounts); downloads come from
          the in-app log. Full member management (refunds, bans, roles) lives in the <b>Clerk</b> and
          <b> Lemon Squeezy</b> dashboards.
        </Note>

        <h2 className="mt-6 mb-1 text-xl font-bold text-navy">Editions</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {catalog.map((e) => (
            <div key={`${e.date}/${e.slug}`} className="flex items-center justify-between border-b border-line p-3 text-sm last:border-0">
              <span><b>{e.instrument}</b> <span className="text-muted-foreground">{e.ticker}</span></span>
              <span className="text-muted-foreground">{e.reportDate} · {e.hasPro ? "Pro ✓" : "free only"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
