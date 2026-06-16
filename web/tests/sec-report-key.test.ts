import { describe, it, expect } from "vitest";
import { classifyReportKey, isValidReportRef } from "../lib/report-key";

// Security: the report-download route (app/api/report/[...key]) serves PRIVATE R2 objects via
// a signed URL, gated purely on what classifyReportKey returns. If a traversal/garbage key
// classified as a valid tier, an attacker could pull an unintended object. These payloads
// assert the allow-list stays anchored. The (date,slug) validator guards the REST + MCP
// detail endpoints the same way before they hit the data layer.

const TRAVERSAL_PAYLOADS = [
  "../secret",
  "../../etc/passwd",
  "2026-06-13/ETH/../../etc/passwd",
  "2026-06-13/ETH/../pro.html",
  "..%2f..%2fetc",
  "%2e%2e/2026-06-13/ETH/pro.html",
  "2026-06-13/..%2f..%2fpro.html",
  "/etc/passwd",
  "\\..\\..\\windows\\win.ini",
  "2026-06-13/ETH/pro.html/../../pro.pdf",
  "....//....//pro.html",
];

const NON_REPORT_OR_MALFORMED = [
  "2026-06-13/ETH/pro.exe",
  "2026-06-13/ETH/metadata.json",
  "2026-06-13/ETH/preview.jpg",
  "2026-06-13/ETH/.env",
  "notadate/ETH/pro.html",
  "2026-13-01/ETH/pro.html", // month 13
  "2026-00-10/ETH/free.html", // month 00
  "2026-06-32/ETH/free.html", // day 32
  "2026-06-13/ET H/pro.pdf", // space in slug
  "2026-06-13/ETH/pro.html?x=1", // query string
  "2026-06-13/ETH/pro.html#frag",
  "2026-06-13/ETH/free.pdf.html", // double extension
  "2026-06-13//pro.html", // empty slug
  "2026-06-13/ETH/PRO.HTML", // wrong case on the literal
  "",
  "   ",
];

describe("classifyReportKey — path-traversal payloads are rejected", () => {
  for (const p of TRAVERSAL_PAYLOADS) {
    it(`rejects traversal: ${JSON.stringify(p)}`, () => {
      expect(classifyReportKey(p)).toBeNull();
    });
  }
});

describe("classifyReportKey — non-report / malformed keys are rejected", () => {
  for (const p of NON_REPORT_OR_MALFORMED) {
    it(`rejects: ${JSON.stringify(p)}`, () => {
      expect(classifyReportKey(p)).toBeNull();
    });
  }
});

describe("classifyReportKey — only the three intended tiers classify", () => {
  it("pro.html / pro.pdf → pro (subscription required)", () => {
    expect(classifyReportKey("2026-06-13/ETH/pro.html")).toBe("pro");
    expect(classifyReportKey("2026-06-13/AAPL/pro.pdf")).toBe("pro");
  });
  it("free.html / free.pdf → free (sign-in required)", () => {
    expect(classifyReportKey("2026-06-13/ETH/free.html")).toBe("free");
    expect(classifyReportKey("2026-06-13/SOL_2/free.pdf")).toBe("free");
  });
  it("preview.png → public (marketing thumbnail)", () => {
    expect(classifyReportKey("2026-06-13/ETH/preview.png")).toBe("public");
  });
});

describe("isValidReportRef — REST/MCP date+slug validation", () => {
  it("accepts a well-formed date + slug", () => {
    expect(isValidReportRef("2026-06-13", "ETH")).toBe(true);
    expect(isValidReportRef("2026-06-13", "SOL_2")).toBe(true);
    expect(isValidReportRef("2026-06-13", "BRK-B")).toBe(true);
  });

  it("rejects traversal / separators in the slug", () => {
    expect(isValidReportRef("2026-06-13", "../etc")).toBe(false);
    expect(isValidReportRef("2026-06-13", "a/b")).toBe(false);
    expect(isValidReportRef("2026-06-13", "..")).toBe(false);
    expect(isValidReportRef("2026-06-13", "ETH/pro.html")).toBe(false);
  });

  it("rejects impossible / malformed dates", () => {
    expect(isValidReportRef("2026-13-01", "ETH")).toBe(false);
    expect(isValidReportRef("2026-00-10", "ETH")).toBe(false);
    expect(isValidReportRef("2026-06-32", "ETH")).toBe(false);
    expect(isValidReportRef("notadate", "ETH")).toBe(false);
    expect(isValidReportRef("2026/06/13", "ETH")).toBe(false);
  });

  it("rejects empty and over-long slugs (DoS / abuse guard)", () => {
    expect(isValidReportRef("2026-06-13", "")).toBe(false);
    expect(isValidReportRef("2026-06-13", "x".repeat(65))).toBe(false);
    expect(isValidReportRef("2026-06-13", "x".repeat(64))).toBe(true); // boundary OK
  });

  it("rejects spaces and query/fragment injection", () => {
    expect(isValidReportRef("2026-06-13", "ET H")).toBe(false);
    expect(isValidReportRef("2026-06-13", "ETH?x=1")).toBe(false);
    expect(isValidReportRef("2026-06-13 ", "ETH")).toBe(false);
  });
});
