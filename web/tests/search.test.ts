import { describe, it, expect } from "vitest";
import { filterEditions, type Filterable } from "../lib/search";

const E: Filterable[] = [
  { instrument: "Ethereum / USD", ticker: "ETH-USD", assetClass: "Cryptocurrency (aggregate spot)", bias: "Bearish-lean", status: "Wait", date: "2026-06-13" },
  { instrument: "Solana / USD", ticker: "SOL-USD", assetClass: "Cryptocurrency (aggregate spot)", bias: "Constructive-lean", status: "Wait", date: "2026-06-13" },
  { instrument: "Apple Inc.", ticker: "AAPL", assetClass: "US single stock (Nasdaq)", bias: "Neutral", status: "Wait", date: "2026-06-12" },
];

describe("filterEditions", () => {
  it("returns everything with no filters", () => {
    expect(filterEditions(E, {})).toHaveLength(3);
  });
  it("searches instrument and ticker case-insensitively", () => {
    expect(filterEditions(E, { q: "aapl" }).map((e) => e.ticker)).toEqual(["AAPL"]);
    expect(filterEditions(E, { q: "ethereum" }).map((e) => e.ticker)).toEqual(["ETH-USD"]);
  });
  it("searches the bias text too", () => {
    expect(filterEditions(E, { q: "constructive" }).map((e) => e.ticker)).toEqual(["SOL-USD"]);
  });
  it("filters by asset class", () => {
    expect(filterEditions(E, { assetClass: "US single stock (Nasdaq)" }).map((e) => e.ticker)).toEqual(["AAPL"]);
  });
  it("combines search + filter (AND)", () => {
    expect(filterEditions(E, { q: "sol", assetClass: "Cryptocurrency (aggregate spot)" })).toHaveLength(1);
    expect(filterEditions(E, { q: "sol", assetClass: "US single stock (Nasdaq)" })).toHaveLength(0);
  });
  it("returns empty when nothing matches", () => {
    expect(filterEditions(E, { q: "gold" })).toHaveLength(0);
  });

  it("filters by a from-date (inclusive)", () => {
    expect(filterEditions(E, { from: "2026-06-13" }).map((e) => e.ticker).sort()).toEqual(["ETH-USD", "SOL-USD"]);
  });
  it("filters by a to-date (inclusive)", () => {
    expect(filterEditions(E, { to: "2026-06-12" }).map((e) => e.ticker)).toEqual(["AAPL"]);
  });
  it("filters by a date range", () => {
    expect(filterEditions(E, { from: "2026-06-13", to: "2026-06-13" })).toHaveLength(2);
    expect(filterEditions(E, { from: "2026-06-10", to: "2026-06-11" })).toHaveLength(0);
  });
  it("combines a date filter with search", () => {
    expect(filterEditions(E, { from: "2026-06-13", q: "sol" }).map((e) => e.ticker)).toEqual(["SOL-USD"]);
  });
});
