import "server-only";
import { sql } from "./db";

// Social-engagement recorder + admin summary (Task T17).
//
// MARKETING-ONLY distribution feedback loop. This is FIREWALLED from research scoring:
// nothing in the confidence / ledger / scoring path imports this module, and this module
// imports ONLY the db client (never confidence, ledger, calibration, or any scoring code).
// Engagement metrics must never influence a report's confidence, bias, or outcome scoring.
// See scripts/test_firewall.py, which enforces this boundary.
//
// All functions are guarded: a missing DB (or the social_engagement table) degrades to a
// no-op / empty result, so callers never throw before the migration is applied.

export type EngagementInput = {
  platform: string;
  postRef?: string | null;
  reportId?: string | null;
  impressions?: number | null;
  engagements?: number | null;
  clicks?: number | null;
};

// Insert one engagement snapshot. Returns true if a row was written, false otherwise
// (no DB configured, or the insert failed). Never throws.
export async function recordEngagement(input: EngagementInput): Promise<boolean> {
  if (!sql) return false;
  const platform = (input.platform || "").trim();
  if (!platform) return false;
  const n = (v: number | null | undefined) =>
    Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0;
  try {
    await sql.query(
      `INSERT INTO social_engagement
         (platform, post_ref, report_id, impressions, engagements, clicks)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        platform,
        input.postRef ?? null,
        input.reportId ?? null,
        n(input.impressions),
        n(input.engagements),
        n(input.clicks),
      ]
    );
    return true;
  } catch {
    return false;
  }
}

export type EngagementSummaryRow = {
  platform: string;
  posts: number;
  impressions: number;
  engagements: number;
  clicks: number;
  lastCapturedAt: string; // "YYYY-MM-DD HH:MI" UTC, or "" if none
};

// Per-platform totals for the admin dashboard. Guarded: returns [] if the DB (or the
// social_engagement table) isn't there yet.
export async function getEngagementSummary(): Promise<EngagementSummaryRow[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT platform,
              count(*)                                   AS posts,
              coalesce(sum(impressions), 0)              AS impressions,
              coalesce(sum(engagements), 0)              AS engagements,
              coalesce(sum(clicks), 0)                   AS clicks,
              to_char(max(captured_at), 'YYYY-MM-DD HH24:MI') AS last_captured_at
         FROM social_engagement
        GROUP BY platform
        ORDER BY impressions DESC`
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      platform: String(r.platform),
      posts: Number(r.posts) || 0,
      impressions: Number(r.impressions) || 0,
      engagements: Number(r.engagements) || 0,
      clicks: Number(r.clicks) || 0,
      lastCapturedAt: r.last_captured_at ? String(r.last_captured_at) : "",
    }));
  } catch {
    return [];
  }
}
