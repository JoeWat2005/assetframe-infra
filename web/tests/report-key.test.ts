import { describe, it, expect } from "vitest";
import { classifyReportKey } from "../lib/report-key";

describe("classifyReportKey", () => {
  it("classifies well-formed Pro keys", () => {
    expect(classifyReportKey("2026-06-13/ETH/pro.html")).toBe("pro");
    expect(classifyReportKey("2026-06-13/AAPL/pro.pdf")).toBe("pro");
    expect(classifyReportKey("2026-06-13/SOL_2/pro.pdf")).toBe("pro");
  });

  it("classifies well-formed free keys", () => {
    expect(classifyReportKey("2026-06-13/ETH/free.html")).toBe("free");
    expect(classifyReportKey("2026-06-13/AAPL/free.pdf")).toBe("free");
    expect(classifyReportKey("2026-06-13/SOL/preview.png")).toBe("free");
  });

  it("rejects path traversal", () => {
    expect(classifyReportKey("../secret")).toBeNull();
    expect(classifyReportKey("2026-06-13/ETH/../../etc/passwd")).toBeNull();
    expect(classifyReportKey("..%2f..%2fetc")).toBeNull();
    expect(classifyReportKey("2026-06-13/a..b/pro.html")).toBeNull();
  });

  it("rejects wrong shapes and non-report files", () => {
    expect(classifyReportKey("2026-06-13/ETH/pro.exe")).toBeNull();
    expect(classifyReportKey("2026-06-13/ETH/metadata.json")).toBeNull();
    expect(classifyReportKey("2026-06-13/ETH/preview.jpg")).toBeNull();
    expect(classifyReportKey("notadate/ETH/pro.html")).toBeNull();
    expect(classifyReportKey("2026-13-99/SOL/free.html")).toBeNull(); // impossible month/day
    expect(classifyReportKey("2026-00-10/SOL/free.html")).toBeNull();
    expect(classifyReportKey("2026-06-13/ETH/pro.html?x=1")).toBeNull();
    expect(classifyReportKey("2026-06-13/ETH/pro.html/x")).toBeNull();
    expect(classifyReportKey("2026-06-13/ETH/free.pdf.html")).toBeNull();
    expect(classifyReportKey("2026-06-13/ET H/pro.pdf")).toBeNull();
    expect(classifyReportKey("")).toBeNull();
  });
});
