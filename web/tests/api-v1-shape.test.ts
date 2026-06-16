import { describe, it, expect, vi } from "vitest";

// reports-api.ts + r2.ts import "server-only" and the content layer (which pulls next/cache,
// node:fs and the Neon client). Stub those so the JSON-safe payload builders can be exercised
// in node, then assert the PUBLIC REST/MCP response shape: required summary fields present,
// the standing disclaimer always attached, filters applied, and limit clamped to 1..200.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
// reports-api imports SITE via the "@/" path alias, which vitest doesn't resolve by default.
// Intercept it by specifier so the module graph loads without a vitest config change.
vi.mock("@/site.config", () => ({
  SITE: { url: "https://www.assetframe.co.uk", disclaimer: "Decision-support research, not advice." },
}));

const SAMPLE = [
  {
    date: "2026-06-15", slug: "BTC", instrument: "Bitcoin", ticker: "BTC",
    assetClass: "crypto", status: "Buy", risk: "Medium", bias: "Bullish",
    lastPrice: "", dataQuality: 90, windowEnd: "2026-06-16T20:00:00Z",
    reportDate: "2026-06-15", catalystStatus: "", freeHtml: "2026-06-15/BTC/free.html",
    freePdf: "2026-06-15/BTC/free.pdf", preview: "2026-06-15/BTC/preview.png",
    hasPro: true, hidden: false, confidence: 60,
  },
  {
    date: "2026-06-15", slug: "AAPL", instrument: "Apple Inc.", ticker: "AAPL",
    assetClass: "equity", status: "Wait", risk: "Low", bias: "Neutral",
    lastPrice: "", dataQuality: 80, windowEnd: "2026-06-16T20:00:00Z",
    reportDate: "2026-06-15", catalystStatus: "", freeHtml: "", freePdf: "",
    preview: "", hasPro: false, hidden: false, confidence: null,
  },
];

vi.mock("../lib/content", () => ({
  getCatalog: vi.fn(async () => SAMPLE),
  getEdition: vi.fn(async () => undefined),
  getEditionProKeys: vi.fn(async () => null),
  getTrackRecord: vi.fn(async () => ({
    stats: { reportsScored: 0, openCalls: 0, predictionsGraded: 0, hitRate: null, longestStreak: 0, currentStreak: 0 },
    open: [], scored: [], calibration: null,
  })),
}));
vi.mock("../lib/r2", () => ({
  getObjectText: vi.fn(async () => null),
  signedReportUrl: vi.fn(async () => null),
}));

import { listReports, getTrackRecordPayload, getReportDetail } from "../lib/reports-api";

const SUMMARY_KEYS = [
  "id", "date", "slug", "instrument", "ticker", "assetClass",
  "status", "risk", "bias", "confidence", "windowEnd", "hasPro", "url",
];

describe("v1 listReports — response shape", () => {
  it("wraps results with total / returned / reports / disclaimer", async () => {
    const r = await listReports({});
    expect(r.total).toBe(2);
    expect(r.returned).toBe(2);
    expect(Array.isArray(r.reports)).toBe(true);
    expect(typeof r.disclaimer).toBe("string");
    expect(r.disclaimer.length).toBeGreaterThan(0);
  });

  it("each summary has exactly the documented public fields (no Pro keys leak)", async () => {
    const { reports } = await listReports({});
    for (const row of reports) {
      for (const k of SUMMARY_KEYS) expect(row).toHaveProperty(k);
      // Must NOT expose internal/Pro file keys or hidden flag in the public shape.
      expect(row).not.toHaveProperty("freeHtml");
      expect(row).not.toHaveProperty("proHtml");
      expect(row).not.toHaveProperty("proPdf");
      expect(row).not.toHaveProperty("hidden");
      expect(row.id).toBe(`${row.date}/${row.slug}`);
      expect(row.url).toContain(`/reports/${row.date}/${row.slug}`);
    }
  });

  it("filters by asset_class (case-insensitive)", async () => {
    const r = await listReports({ assetClass: "CRYPTO" });
    expect(r.total).toBe(1);
    expect(r.reports[0].slug).toBe("BTC");
  });

  it("filters by free-text query over instrument/ticker/slug", async () => {
    expect((await listReports({ query: "apple" })).total).toBe(1);
    expect((await listReports({ query: "btc" })).total).toBe(1);
    expect((await listReports({ query: "nope" })).total).toBe(0);
  });

  it("clamps limit into 1..200 and never returns more than the catalog", async () => {
    expect((await listReports({ limit: 1 })).returned).toBe(1);
    expect((await listReports({ limit: 9999 })).returned).toBe(2); // clamped to 200, but only 2 exist
    // limit is floored to a minimum of 1, so non-positive values return a single row, never 0.
    expect((await listReports({ limit: 0 })).returned).toBe(1);
    expect((await listReports({ limit: -5 })).returned).toBe(1);
    expect((await listReports({})).returned).toBe(2); // default 50 → all available
  });

  it("confidence is a number or null (never undefined) in the payload", async () => {
    const { reports } = await listReports({});
    const btc = reports.find((r) => r.slug === "BTC")!;
    const aapl = reports.find((r) => r.slug === "AAPL")!;
    expect(btc.confidence).toBe(60);
    expect(aapl.confidence).toBeNull();
  });
});

describe("v1 getReportDetail / track-record — response shape", () => {
  it("returns null for an unknown edition (→ route emits 404)", async () => {
    expect(await getReportDetail("2026-06-15", "MISSING")).toBeNull();
  });

  it("track-record payload always carries the stats block and the disclaimer", async () => {
    const tr = await getTrackRecordPayload();
    expect(tr).toHaveProperty("stats");
    expect(tr.stats).toHaveProperty("hitRate");
    expect(tr).toHaveProperty("open");
    expect(tr).toHaveProperty("scored");
    expect(typeof tr.disclaimer).toBe("string");
  });
});
