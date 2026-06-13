import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { ExternalLink, BarChart3, Gauge } from "lucide-react";
import { getCatalog, getTrackRecord } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { Hero, Note } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  if (!ent.admin) redirect("/account"); // non-admins never see this

  const catalog = await getCatalog();
  const tr = await getTrackRecord();

  // Member stats from Clerk (first page; fine for an MVP dashboard).
  let totalMembers = 0;
  let subscribers = 0;
  let recent: { email: string; subscribed: boolean }[] = [];
  try {
    const cc = await clerkClient();
    const list = await cc.users.getUserList({ limit: 50, orderBy: "-created_at" });
    totalMembers = list.totalCount;
    for (const u of list.data) {
      const sub = (u.publicMetadata as { subscribed?: boolean })?.subscribed === true;
      if (sub) subscribers += 1;
      recent.push({ email: u.primaryEmailAddress?.emailAddress ?? u.id, subscribed: sub });
    }
    recent = recent.slice(0, 12);
  } catch {
    // Clerk not configured yet — show content stats only.
  }

  const stat = (n: React.ReactNode, l: string) => (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-3xl font-extrabold text-navy">{n}</div>
      <div className="mt-1 text-[13px] text-muted">{l}</div>
    </div>
  );

  return (
    <>
      <Hero title="Admin" tag="Operations overview — visible to admins only." />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stat(totalMembers, "Members")}
          {stat(subscribers, "Pro (first page)")}
          {stat(catalog.length, "Editions")}
          {stat(tr.stats.openCalls, "Open calls")}
          {stat(tr.stats.reportsScored, "Scored")}
        </div>

        <div className="mt-6 rounded-xl border border-line bg-white p-4">
          <h2 className="text-base font-bold text-navy">Traffic &amp; performance</h2>
          <p className="mt-1 text-sm text-muted">
            Visitors, page views and Core Web Vitals are collected by Vercel Analytics &amp; Speed
            Insights and shown in your Vercel dashboard (privacy-friendly, no cookie banner needed).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={SITE.analyticsUrl} target="_blank" rel="noopener noreferrer">
                <BarChart3 data-icon="inline-start" />
                Web Analytics
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={SITE.analyticsUrl} target="_blank" rel="noopener noreferrer">
                <Gauge data-icon="inline-start" />
                Speed Insights
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </div>

        <Note>
          Full member management (invite, ban, refund, role changes) lives in the <b>Clerk</b> and
          <b> Lemon Squeezy</b> dashboards. This page is a read-only operational glance. The subscriber
          count samples the most recent 50 members; wire Supabase later for exact totals and analytics.
        </Note>

        <h2 className="mt-6 mb-1 text-xl font-bold text-navy">Recent members</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {recent.length === 0 ? (
            <p className="p-4 text-sm text-muted">No members yet (or Clerk not configured).</p>
          ) : recent.map((m) => (
            <div key={m.email} className="flex items-center justify-between border-b border-line p-3 text-sm last:border-0">
              <span>{m.email}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.subscribed ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-tile text-muted"}`}>
                {m.subscribed ? "Pro" : "Free"}
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-6 mb-1 text-xl font-bold text-navy">Editions</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {catalog.map((e) => (
            <div key={`${e.date}/${e.slug}`} className="flex items-center justify-between border-b border-line p-3 text-sm last:border-0">
              <span><b>{e.instrument}</b> <span className="text-muted">{e.ticker}</span></span>
              <span className="text-muted">{e.reportDate} · {e.hasPro ? "Pro ✓" : "free only"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
