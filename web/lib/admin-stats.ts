import "server-only";
import { unstable_cache } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { sql } from "./db";
import { getCatalog } from "./content";

export type DayPoint = { date: string; count: number };

export type AdminStats = {
  members: number;
  subscribers: number;
  membersCapped: boolean; // true if we stopped scanning before counting everyone
  signups30d: DayPoint[];
  downloads30d: DayPoint[];
  downloadsTotal: number;
  topReports: { reportId: string; count: number }[];
  editionsByClass: { assetClass: string; count: number }[];
  recent: { id: string; email: string; subscribed: boolean }[];
};

// Last 30 calendar days (UTC), oldest → newest, as YYYY-MM-DD.
function last30Days(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type Row = Record<string, unknown>;

async function _getAdminStats(): Promise<AdminStats> {
  const days = last30Days();
  const signupMap = new Map<string, number>(days.map((d) => [d, 0]));
  const recent: AdminStats["recent"] = [];
  let members = 0;
  let subscribers = 0;
  let membersCapped = false;

  // Bare-minimum Clerk read: ONE page of the newest accounts (not a full multi-page
  // scan). Gives the member count (totalCount), the recent-members list, the 30-day
  // signup sparkline, and the Pro-subscriber count. Clerk Billing is the source of truth for
  // Pro and mirrors it onto publicMetadata.subscribed, so we count that flag here — the
  // separate billing table is gone. The count is over the scanned page (newest 100), so it's
  // capped exactly like the charts when there are more than 100 members (membersCapped).
  try {
    const cc = await clerkClient();
    let page;
    try {
      // Newest first so "recent members" + the signup chart are right.
      page = await cc.users.getUserList({ limit: 100, orderBy: "-created_at" });
    } catch {
      // Some Clerk instances reject the orderBy param — fall back to an unordered page
      // rather than letting the whole stats block fail (the bug that zeroed the dashboard).
      page = await cc.users.getUserList({ limit: 100 });
    }
    members = typeof page.totalCount === "number" ? page.totalCount : page.data.length;
    membersCapped = members > page.data.length; // charts + recent + subscriber count cover the newest 100 only
    for (const u of page.data) {
      const created = new Date(Number(u.createdAt)).toISOString().slice(0, 10);
      if (signupMap.has(created)) signupMap.set(created, (signupMap.get(created) ?? 0) + 1);
      const sub = (u.publicMetadata as { subscribed?: boolean })?.subscribed === true;
      if (sub) subscribers++;
      if (recent.length < 12) {
        recent.push({ id: u.id, email: u.primaryEmailAddress?.emailAddress ?? u.id, subscribed: sub });
      }
    }
  } catch {
    /* Clerk unavailable — the DB-backed stats below still render */
  }

  // Downloads from the log (if a DB is configured and the table exists).
  const downloadMap = new Map<string, number>(days.map((d) => [d, 0]));
  let downloadsTotal = 0;
  let topReports: AdminStats["topReports"] = [];
  if (sql) {
    try {
      const rows = (await sql.query(
        `SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, count(*)::int AS c
         FROM download_log WHERE ts >= now() - interval '30 days' GROUP BY 1`
      )) as Row[];
      for (const r of rows) {
        const d = String(r.d);
        if (downloadMap.has(d)) downloadMap.set(d, Number(r.c) || 0);
      }
      const tot = (await sql.query(`SELECT count(*)::int AS c FROM download_log`)) as Row[];
      downloadsTotal = Number(tot[0]?.c) || 0;
      const top = (await sql.query(
        `SELECT report_id, count(*)::int AS c FROM download_log GROUP BY 1 ORDER BY c DESC LIMIT 8`
      )) as Row[];
      topReports = top.map((r) => ({ reportId: String(r.report_id ?? ""), count: Number(r.c) || 0 }));
    } catch {
      /* download_log not migrated yet */
    }
  }

  // Editions by asset class from the catalog.
  const classMap = new Map<string, number>();
  try {
    for (const e of await getCatalog()) {
      const k = e.assetClass || "Other";
      classMap.set(k, (classMap.get(k) ?? 0) + 1);
    }
  } catch {
    /* ignore */
  }

  return {
    members,
    subscribers,
    membersCapped,
    signups30d: days.map((d) => ({ date: d, count: signupMap.get(d) ?? 0 })),
    downloads30d: days.map((d) => ({ date: d, count: downloadMap.get(d) ?? 0 })),
    downloadsTotal,
    topReports,
    editionsByClass: [...classMap.entries()].map(([assetClass, count]) => ({ assetClass, count })),
    recent,
  };
}

// Cached so rapid admin reloads don't re-scan Clerk + re-query downloads each time.
export const getAdminStats = unstable_cache(_getAdminStats, ["admin-stats"], { revalidate: 120, tags: ["content"] });
