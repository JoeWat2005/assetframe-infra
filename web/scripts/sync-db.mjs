// Sync the generated content (web/content/*.json) into Neon Postgres.
// Run after `python scripts/export_content.py`:  node scripts/sync-db.mjs
// Applies to EVERY configured target so one publish updates prod AND the dev branch:
//   DATABASE_URL        (primary / production — Neon main branch)
//   DATABASE_URL_DEV    (optional — Neon `development` branch, used by preview deploys)
// Each target: upserts editions, replaces the track-record snapshot (open calls + scored).
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const web = path.join(here, "..");                         // web

// Load env from web/.env.local for any keys not already in the environment.
try {
  for (const line of readFileSync(path.join(web, ".env.local"), "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
} catch { /* no .env.local */ }

const readJson = (f) => JSON.parse(readFileSync(path.join(web, "content", f), "utf-8"));
const toInt = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : parseInt(v, 10));

// Targets: primary (prod) + optional dev branch. Dedupe identical URLs.
const primary =
  process.env.DATABASE_URL || process.env.POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL || process.env.STORAGE_URL;
const dev = process.env.DATABASE_URL_DEV || process.env.DEV_DATABASE_URL;
const targets = [];
if (primary) targets.push(["production", primary]);
if (dev && dev !== primary) targets.push(["dev branch", dev]);

if (targets.length === 0) {
  console.error("No DATABASE_URL — set it in web/.env.local or the environment.");
  process.exit(1);
}

// Schema is owned by node-pg-migrate (web/migrations). Run `npm run migrate:up` first
// (against each branch), or `npm run db:setup`. This script only syncs DATA.
async function syncOne(label, url) {
  const sql = neon(url);

  // 1. editions (upsert)
  const catalog = readJson("catalog.json");
  for (const e of catalog) {
    const id = `${e.date}/${e.slug}`;
    await sql.query(
      `INSERT INTO editions (id, report_date, slug, instrument, ticker, asset_class, status, risk, bias,
         data_quality, window_end, catalyst_status, has_pro, free_html_key, free_pdf_key, preview_key,
         pro_html_key, pro_pdf_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         report_date=excluded.report_date, slug=excluded.slug, instrument=excluded.instrument,
         ticker=excluded.ticker, asset_class=excluded.asset_class, status=excluded.status,
         risk=excluded.risk, bias=excluded.bias, data_quality=excluded.data_quality,
         window_end=excluded.window_end, catalyst_status=excluded.catalyst_status, has_pro=excluded.has_pro,
         free_html_key=excluded.free_html_key, free_pdf_key=excluded.free_pdf_key,
         preview_key=excluded.preview_key, pro_html_key=excluded.pro_html_key, pro_pdf_key=excluded.pro_pdf_key`,
      [id, e.date, e.slug, e.instrument, e.ticker, e.assetClass, e.status, e.risk, e.bias,
       toInt(e.dataQuality), e.windowEnd, e.catalystStatus, !!e.hasPro, e.freeHtml, e.freePdf, e.preview,
       e.hasPro ? `${e.date}/${e.slug}/pro.html` : null, e.hasPro ? `${e.date}/${e.slug}/pro.pdf` : null]
    );
  }

  // 2. track record (snapshot — replace open_calls + predictions + scored_results)
  const track = readJson("track-record.json");
  await sql.query("DELETE FROM open_calls"); // cascades to open_call_predictions
  let predCount = 0;
  for (const c of track.open || []) {
    await sql.query(
      `INSERT INTO open_calls (report_id, instrument, symbol, view, confidence, window_end, n, n_manual, hits, scored)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [c.reportId, c.instrument, c.symbol, c.view, String(c.confidence), c.windowEnd, c.n || 0, c.nManual || 0,
       c.hits || 0, !!c.scored]
    );
    const preds = c.predictions || [];
    for (let i = 0; i < preds.length; i++) {
      const p = preds[i];
      await sql.query(
        `INSERT INTO open_call_predictions (report_id, seq, pred_id, type, text, manual, expect)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (report_id, pred_id) DO UPDATE SET
           seq=excluded.seq, type=excluded.type, text=excluded.text,
           manual=excluded.manual, expect=excluded.expect`,
        [c.reportId, i + 1, p.id || `P${i + 1}`, p.type || "", p.text || "",
         !!p.manual, typeof p.expect === "boolean" ? p.expect : null]
      );
      predCount++;
    }
  }
  await sql.query("DELETE FROM scored_results");
  for (const r of track.scored || []) {
    await sql.query(
      `INSERT INTO scored_results (report_id, instrument, view, confidence, results, hits, misses, hit_rate, window_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [r.reportId || null, r.instrument, r.view, String(r.confidence), r.results,
       toInt(r.hits), toInt(r.misses), String(r.hitRate), r.windowEnd]
    );
  }
  console.log(`  [${label}] editions: ${catalog.length}, open_calls: ${(track.open || []).length} (${predCount} predictions), scored_results: ${(track.scored || []).length}`);
}

let failures = 0;
for (const [label, url] of targets) {
  try {
    await syncOne(label, url);
  } catch (err) {
    failures++;
    console.error(`  [${label}] FAILED: ${err.message}`);
  }
}
console.log(targets.length > 1
  ? `done — synced ${targets.length} database(s)${failures ? `, ${failures} failed` : ""}`
  : "done — synced to Neon");
if (failures) process.exit(1);
