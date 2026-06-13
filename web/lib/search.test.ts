import { describe, it, expect } from "vitest";
import { filterEditions, sortEditions, type Filterable } from "./search";

const rows: Filterable[] = [
  { instrument: "Ethereum", ticker: "ETH-USD", assetClass: "Crypto", bias: "Bullish above 3000", status: "Buy", date: "2026-06-10" },
  { instrument: "Apple", ticker: "AAPL", assetClass: "Equity", bias: "Wait for the pullback", status: "Wait", date: "2026-06-12" },
  { instrument: "Solana", ticker: "SOL-USD", assetClass: "Crypto", bias: "Neutral chop", status: "Stand aside", date: "2026-06-01" },
];

describe("filterEditions", () => {
  it("returns every row when no filters are set", () => {
    expect(filterEditions(rows, {})).toHaveLength(3);
  });

  it("matches the query across instrument, ticker and bias", () => {
    expect(filterEditions(rows, { q: "apple" }).map((r) => r.ticker)).toEqual(["AAPL"]);
    expect(filterEditions(rows, { q: "sol-usd" }).map((r) => r.instrument)).toEqual(["Solana"]);
    expect(filterEditions(rows, { q: "pullback" }).map((r) => r.instrument)).toEqual(["Apple"]);
  });

  it("filters by asset class and status exactly", () => {
    expect(filterEditions(rows, { assetClass: "Crypto" })).toHaveLength(2);
    expect(filterEditions(rows, { status: "Buy" }).map((r) => r.instrument)).toEqual(["Ethereum"]);
  });

  it("applies inclusive date bounds", () => {
    expect(filterEditions(rows, { from: "2026-06-05" }).map((r) => r.instrument).sort()).toEqual(["Apple", "Ethereum"]);
    expect(filterEditions(rows, { to: "2026-06-05" }).map((r) => r.instrument)).toEqual(["Solana"]);
  });

  it("combines filters with AND semantics", () => {
    expect(filterEditions(rows, { assetClass: "Crypto", from: "2026-06-05" }).map((r) => r.instrument)).toEqual(["Ethereum"]);
  });
});

describe("sortEditions", () => {
  it("orders newest first by date", () => {
    expect(sortEditions(rows, "newest").map((r) => r.date)).toEqual(["2026-06-12", "2026-06-10", "2026-06-01"]);
  });

  it("orders oldest first by date", () => {
    expect(sortEditions(rows, "oldest").map((r) => r.date)).toEqual(["2026-06-01", "2026-06-10", "2026-06-12"]);
  });

  it("orders by instrument A→Z", () => {
    expect(sortEditions(rows, "instrument").map((r) => r.instrument)).toEqual(["Apple", "Ethereum", "Solana"]);
  });

  it("does not mutate the input array", () => {
    const before = [...rows];
    sortEditions(rows, "oldest");
    expect(rows).toEqual(before);
  });
});
