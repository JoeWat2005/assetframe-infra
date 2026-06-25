import "server-only";
import { getCatalog, getEdition, getTrackRecord, cadenceOf, type Edition, type TrackRecord } from "./content";
import { getObjectText, signedReportUrl } from "./r2";
import { SITE } from "@/site.config";

// Shared JSON-safe payload builders for the MCP server and the public REST API. Both reuse
// the same content/R2 layer the website uses, and every payload carries the standing
// disclaimer (this is research/decision-support, never advice).

const DISCLAIMER = SITE.disclaimer;
const BASE = SITE.url.replace(/\/$/, "");

export type ReportSummary = {
  id: string;
  date: string;
  slug: string;
  instrument: string;
  ticker: string;
  assetClass: string;
  assetClassKey: string;
  status: string;
  risk: string;
  bias: string;
  confidence: number | null;
  windowEnd: string;
  hasPro: boolean;
  url: string;
  cadence: string;
};

function toSummary(e: Edition): ReportSummary {
  return {
    id: `${e.date}/${e.slug}`,
    date: e.date,
    slug: e.slug,
    instrument: e.instrument,
    ticker: e.ticker,
    assetClass: e.assetClass,
    assetClassKey: assetClassKey(e.assetClass),
    status: e.status,
    risk: e.risk,
    bias: e.bias,
    confidence: e.confidence ?? null,
    windowEnd: e.windowEnd,
    hasPro: e.hasPro,
    url: `${BASE}/reports/${e.date}/${e.slug}`,
    cadence: e.scoredCadence || cadenceOf(e.reportId || ""),
  };
}

export type ListFilters = {
  assetClass?: string;
  status?: string;
  date?: string;
  query?: string;
  cadence?: string;
  limit?: number;
};

// Normalise a friendly cadence to daily|weekly|monthly.
function normCadence(v: string): string {
  const x = (v || "").trim().toLowerCase();
  if (["weekly", "week"].includes(x)) return "weekly";
  if (["monthly", "month"].includes(x)) return "monthly";
  if (["daily", "day"].includes(x)) return "daily";
  return x;
}

// Map a display asset class ("Crypto - major", "US equity", "Equity index future") to a short
// key so the asset_class filter accepts crypto|fx|equity|index|commodity|rates as well as the
// exact stored label.
function assetClassKey(display: string): string {
  const d = display.toLowerCase();
  if (d.includes("crypto")) return "crypto";
  if (d.includes("fx") || d.includes("forex") || d.includes("currency")) return "fx";
  if (d.includes("index")) return "index";
  if (d.includes("equity") || d.includes("stock")) return "equity";
  if (d.includes("commodit") || d.includes("metal") || d.includes("energy")) return "commodity";
  if (d.includes("bond") || d.includes("rate")) return "rates";
  return d;
}

export async function listReports(f: ListFilters = {}) {
  let items = await getCatalog();
  if (f.assetClass) {
    const a = f.assetClass.toLowerCase().trim();
    items = items.filter((e) => {
      const disp = e.assetClass.toLowerCase();
      return disp === a || assetClassKey(disp) === a;
    });
  }
  if (f.status) {
    const s = f.status.toLowerCase();
    items = items.filter((e) => e.status.toLowerCase() === s);
  }
  if (f.date) items = items.filter((e) => e.date === f.date);
  if (f.cadence) {
    const c = normCadence(f.cadence);
    items = items.filter((e) => (e.scoredCadence || cadenceOf(e.reportId || "")) === c);
  }
  if (f.query) {
    const q = f.query.toLowerCase();
    items = items.filter((e) => `${e.instrument} ${e.ticker} ${e.slug}`.toLowerCase().includes(q));
  }
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  return {
    total: items.length,
    returned: Math.min(items.length, limit),
    reports: items.slice(0, limit).map(toSummary),
    disclaimer: DISCLAIMER,
  };
}

// Crude HTML→text for returning Snapshot content to an agent (the Snapshot HTML twin is one
// page; this keeps it readable without pulling in a parser).
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getReportDetail(date: string, slug: string) {
  const e = await getEdition(date, slug);
  if (!e) return null;
  // R2 object keys are the bare "<date>/<slug>/<file>" — NOT the "/api/report/..." route paths
  // the DB stores (those are for the gated web route). Build the keys directly from date+slug.
  let snapshotText = "";
  const html = await getObjectText(`${e.date}/${e.slug}/free.html`);
  if (html) snapshotText = htmlToText(html);
  const snapshotPdfUrl = await signedReportUrl(`${e.date}/${e.slug}/free.pdf`, 600);
  return {
    ...toSummary(e),
    snapshotText,
    snapshotPdfUrl,
    proAvailable: e.hasPro,
    proAccess: e.hasPro ? `Subscribe at ${BASE}/pricing to unlock the full Pro analysis.` : null,
    disclaimer: DISCLAIMER,
  };
}

// Gated Pro detail — only call after confirming the caller is an entitled subscriber.
export async function getProReportDetail(date: string, slug: string) {
  const e = await getEdition(date, slug);
  if (!e || !e.hasPro) return null;
  // Bare R2 keys (see getReportDetail) — the stored pro_*_key columns are route paths.
  let proText = "";
  const html = await getObjectText(`${e.date}/${e.slug}/pro.html`);
  if (html) proText = htmlToText(html);
  const proPdfUrl = await signedReportUrl(`${e.date}/${e.slug}/pro.pdf`, 600);
  return { ...toSummary(e), proText, proPdfUrl, disclaimer: DISCLAIMER };
}

// Normalise a friendly timeframe to a taxonomy horizon. weekly/monthly -> multi_session,
// hourly -> intraday, daily -> next_session; an exact horizon passes through.
function normHorizon(v: string): string {
  const x = (v || "").trim().toLowerCase();
  if (["weekly", "monthly", "multi", "multi_session", "week", "month"].includes(x)) return "multi_session";
  if (["hourly", "intraday", "hour"].includes(x)) return "intraday";
  if (["daily", "next_session", "session", "day"].includes(x)) return "next_session";
  return x;
}

export async function getTrackRecordPayload(opts: { horizon?: string; cadence?: string } = {}) {
  const tr: TrackRecord = await getTrackRecord();
  const coerceConf = (raw: string | number): number | null => {
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  };
  const hz = opts.horizon ? normHorizon(opts.horizon) : "";
  const cad = opts.cadence ? normCadence(opts.cadence) : "";
  const matchHz = (h?: string) => !hz || (h || "next_session") === hz;
  const matchCad = (c?: string, rid?: string) => !cad || (c || cadenceOf(rid || "")) === cad;
  const open = tr.open
    .filter((c) => matchHz(c.horizon) && matchCad(c.scoredCadence, c.reportId))
    .map((c) => ({ ...c, confidence: coerceConf(c.confidence) }));
  const scored = tr.scored
    .filter((x) => matchHz(x.horizon) && matchCad(x.scoredCadence, x.reportId))
    .map((x) => ({ ...x, confidence: coerceConf(x.confidence) }));
  // When filtered to one horizon/cadence, surface that slice's headline stats.
  const hzEntry = hz ? (tr.byHorizon || []).find((b) => b.horizon === hz) : undefined;
  const cadEntry = cad ? (tr.byCadence || []).find((b) => b.cadence === cad) : undefined;
  const slice = cadEntry || hzEntry;
  const stats = hz || cad
    ? {
        ...tr.stats, reportsScored: scored.length, openCalls: open.length,
        predictionsGraded: slice ? slice.hits + slice.misses : 0,
        hitRate: slice ? slice.hitRate : null,
      }
    : tr.stats;
  return {
    ...tr,
    stats,
    open,
    scored,
    ...(hz ? { filteredByHorizon: hz } : {}),
    ...(cad ? { filteredByCadence: cad } : {}),
    disclaimer: DISCLAIMER,
  };
}
