# `intraday.py` — data fetch + analysis engine

`scripts/intraday.py` is the data layer of the report engine: a **stdlib-only** OHLC fetcher and technical-analysis compiler. It produces the per-instrument hourly + daily candle CSVs and the analysis JSON that every downstream step reads. No third-party packages — `urllib`, `csv`, `json`, `math`, `concurrent.futures` only (module docstring lines 1–63, imports lines 64–67).

> Always read the JSON's `freshness`, `degraded`, and `provider` blocks before trusting any number (`mvp/CLAUDE.md` data-source rules; `SKILL.md` step 2).

## Purpose

- Fetch hourly (`60m`) and daily (`1d`) OHLCV for a symbol, plus optional related symbols.
- Compute daily regime indicators and hourly intraday indicators.
- Derive classic floor pivots and ATR day-range bands (the day-projection levels the scaffold turns into canonical levels).
- Emit honest metadata: staleness/market-state (`freshness`), a `degraded` flag, per-series `provider`, and display-vs-fetched `windows` with per-SMA warm-up sufficiency.

## CLI

```
python scripts/intraday.py SYMBOL [--name NAME] [--datadir data]
       [--hrange 10d] [--drange 1y] [--roll-utc 22] [--related "SYM1,SYM2,SYM3"]
       [--provider yahoo|eodhd] [--anchor live|prior-completed|friday]
```

Arguments are parsed positionally as `--flag value` pairs (`main()` line 431: `dict(zip(sys.argv[2::2], sys.argv[3::2]))`), so each flag takes exactly one value.

| Flag | Default | Meaning |
|---|---|---|
| `SYMBOL` | (required, `sys.argv[1]`) | **Yahoo format** symbol — see below |
| `--name NAME` | symbol stripped of `=` and `^` (`GC=F` → `GCF`) | output file prefix; pass the canonical instrument prefix (`XAUUSD`, `GBPJPY`, `BTC`, `ES`, …) |
| `--datadir` | `data` | base directory for `candles/` and `analysis/` |
| `--hrange` | `10d` | hourly **display** window (days) |
| `--drange` | `1y` | daily **display** range |
| `--roll-utc` | `0` | hour (UTC) at which the session day rolls; FX/crypto/futures use `22` (NY close); equities run WITHOUT a roll |
| `--related` | (none) | comma-separated symbols for the cross-asset table |
| `--provider` | env `ADVISOR_DATA_PROVIDER` or `yahoo` | `yahoo` or `eodhd` |
| `--anchor` | `live` | pivot/band anchoring mode — see below. Invalid value → exit 2 (lines 440–443) |

Symbols are **always Yahoo format**, mapped per provider by the provider layer: `BP.L`, `TSCO.L`, `^FTSE`, `GBPUSD=X`, `BZ=F`, `GC=F`, `BTC-USD`, `AAPL` (docstring lines 24–25).

### Example invocations

From `SKILL.md` step 2 and `README.md`:

```
python scripts/intraday.py BP.L --name BP --hrange 10d --roll-utc 22 --related "^FTSE,GBPUSD=X"
python scripts/intraday.py GC=F --name XAUUSD --hrange 10d --anchor prior-completed --roll-utc 22
```

## Providers (Yahoo / EODHD switch; futures stay Yahoo)

`fetch_chart()` (lines 185–210) is the provider-agnostic entry; `PROVIDER_DEFAULT = os.environ.get("ADVISOR_DATA_PROVIDER", "yahoo")` (line 70).

- **`yahoo`** (default) — `yahoo_chart()` (lines 78–91) hits the Yahoo v8 chart API, no key. Unofficial: fine for dev, **not licensed for a commercial product** (docstring lines 28–29).
- **`eodhd`** — set `ADVISOR_DATA_PROVIDER=eodhd` + `EODHD_API_KEY=…` or pass `--provider eodhd`. Licensed feed; LSE 15-min delayed. `eodhd_chart()` (lines 134–182) + `map_symbol_eodhd()` (lines 101–121).

**Futures (`=F`) always come from Yahoo.** `map_symbol_eodhd()` returns `(None, "futures")` for any `=F` symbol (line 103–104), and `fetch_chart()` treats `esym is None` as "not covered → served by yahoo" (lines 193–196). **Any EODHD failure also falls back to Yahoo per-fetch**: missing key, 0 rows, or an exception each set a `note` and drop through to `yahoo_chart()` (lines 196–209). The actual server for each series is recorded in the JSON `provider` block; the human-readable reason is in `provider.note`.

EODHD exchange mapping (line 96–97, `EODHD_EXCH_MAP`): only `.L → .LSE` is verified from the docs; the rest follow the documented pattern. **`NOT VERIFIED`** for the other suffixes (`.PA`, `.AS`, `.DE→.XETRA`, etc.) and the FOREX/INDX/CC mappings — the docstring itself flags "verify with a live key before relying on them" (lines 94–95, 169 "docs name the field ambiguously"). To check: run against a live `EODHD_API_KEY` and read `provider.note`.

## `--anchor` semantics

`--anchor` re-derives floor pivots + ATR day-bands on a chosen **completed** daily session instead of the live/in-progress one — the pre-market case. It **replaces the old hand-built `*_anchored.json` step** (docstring lines 8–19; override block lines 613–655).

| Mode | Pivots from | Bands anchored on |
|---|---|---|
| `live` (default) | prior completed session HLC | **today's session open** |
| `prior-completed` | last completed daily session's HLC | that session's **close** |
| `friday` | most recent completed **Friday** session | that Friday's **close** |

`friday` falls back to the last completed session if no completed Friday exists, recording `anchor.note` (lines 634–638). When `--anchor != live`:

- `pivots_classic` and `atr_day_bands` are **OVERWRITTEN** with the anchored values, so `scaffold_payload.py` consumes them transparently (lines 649–653).
- The live values are preserved under `pivots_classic_live` / `atr_day_bands_live` (lines 649, 712–717).
- An `anchor` block documents the choice (`mode`, `applied`, `session_date`, `anchor_close`, optional `note`/`reason`) (lines 620, 654–655, 712–713).
- If nothing safe to anchor on (no completed daily bar, or no daily ATR), the live values are left untouched and `anchor.applied=false` with a `reason` (lines 639–644).

The session day for "completed" is computed under the roll convention (`_sess_date()`, lines 624–625).

`compute_pivots_bands(prior_hlc, anchor_close, atr_daily)` (lines 398–426) is the **shared math** for both the live and anchored paths — byte-for-byte identical to the original inline block (golden-file tested). Pivots: classic floor PP/R1-R3/S1-S3 from prior HLC. Bands: `open` (= anchor close), `inner_hi/lo` = anchor ± 0.5·ATRd, `outer_hi/lo` = anchor ± 1.0·ATRd. Returns `(None, …)` when `prior_hlc` is falsy; `(…, None)` when `atr_daily` is falsy/0 or `anchor_close` is None.

## Outputs

Written under `<datadir>` (lines 497–508, 718):

| File | Contents |
|---|---|
| `data/candles/<NAME>_hourly.csv` | `datetime_utc,open,high,low,close,volume` (UTC `%Y-%m-%d %H:%M`, 6dp prices) |
| `data/candles/<NAME>_daily.csv` | `date,open,high,low,close,volume` (UTC `%Y-%m-%d`) |
| `data/analysis/<NAME>_analysis.json` | the analysis object below |

The JSON is also printed to stdout. The CSV paths are echoed back in the JSON `files` block (lines 709–710) so the scaffold knows exactly which file to read for the last-price triple-equality.

## The analysis JSON blocks

Assembled in `out` (lines 679–718). Top-level keys:

- `symbol`, `timezone` (exchange TZ from meta), `fetched_utc`, `last_price` (`regularMarketPrice` from the best meta), `last_bar_utc`.
- **`degraded`** — `null` or `"daily_only"` (see below).
- **`errors`** — per-stage error strings or `null`.
- **`freshness`** — from `freshness_block()` (lines 213–259). Per-asset-class staleness + market-state read on the freshest bar:
  - crypto (`CRYPTOCURRENCY`): `open`, stale if `age > 180 min`.
  - FX/futures (`CURRENCY`/`FUTURE(S)`): weekend = Fri 22:00 → Sun 22:00 UTC (lenient across DST, never false-stale); inside session `open` stale > 180 min.
  - equities/ETFs/indices: uses Yahoo's `currentTradingPeriod.regular` — in-session stale > 90 min; out-of-session stale > 96 h (so weekends/holidays never false-flag). Missing meta (e.g. EODHD) → `unknown` + the 96 h rule.
  - `granularity="daily"`: staleness collapses to the 96 h dead-feed rule only (daily bars are stamped at session open, so age ≠ feed lag). Fields: `last_bar_utc`, `age_minutes`, `instrument_type`, `market_state`, `stale` (bool), `stale_reason`, `bar_granularity`.
- **`windows`** — display vs fetched ranges + per-SMA warm-up sufficiency (lines 668–677): `hourly_display`/`hourly_fetched`, `daily_display`/`daily_fetched`, and `sma_warm_at_display_start` with booleans `h20`, `h50`, `rsi14_hourly`, `d50`, `d200`, `rsi14_daily`. `warm()` (lines 660–664) is true when at least `n` bars exist *before* the display cutoff, so the line is valid from the first visible bar. **Never infer trend from a cold SMA.**
- **`provider`** — `{hourly, daily, note}` (lines 688–690): which provider actually served each series + a joined human note.
- **`hourly`** — `null` in degraded mode (lines 547–568); else: `bars`, `sma20`, `sma50`, `ema9`, `ema21`, `ema_cross`, `rsi14`, `macd` (`{macd,signal,hist,hist_prev,cross}`), `atr14`, `swing_highs`, `swing_lows` (last 5 each, fractal `k=2`), `vwap_session` (session VWAP when volume > 0), `above_sma20`.
- **`trend`** — `long_term_daily` (`classify_long_term`, lines 316–327: Uptrend/Downtrend/Range vote on price vs SMA200, SMA50/200 cross, slope), `intraday_hourly` (`classify_intraday_trend`, lines 330–340), `alignment` (`alignment_verdict`, lines 343–350), `golden_cross` (SMA50 > SMA200).
- **`stats_last_sessions`** — `level_stats()` (lines 353–383): empirical band-containment + pivot-touch rates over up to 120 completed sessions. **Approximation: uses the CURRENT ATR for all historical bands** (stated in the `note`). Fields: `sessions_evaluated`, `close_inside_inner_band_pct`, `close_inside_outer_band_pct`, `touched_PP_pct`, `touched_R1_pct`, `touched_S1_pct`, `median_session_range`, `note`.
- **`related`** — per related symbol: `last`, `chg_1d_pct`, `chg_5d_pct`, or `error` (lines 474–482).
- **`daily`** — `bars`, `sma20/50/100/200`, `rsi14`, `atr14` (Wilder), `realized_vol_20d_pct` (annualised log-return stdev ×√252, lines 570–575), `prior_session`, `today_session` (each `{date,o,h,l,c,session_roll_utc[,basis]}` via `session_out()`).
- **`pivots_classic`** — PP/R1-R3/S1-S3 (6dp), optional `basis` tag.
- **`atr_day_bands`** — `open`/`inner_hi`/`inner_lo`/`outer_hi`/`outer_lo` (6dp), optional `anchor` tag.
- **`files`** — `{hourly_csv, daily_csv}` POSIX paths.
- When `--anchor != live`: also `anchor`, and (when present) `pivots_classic_live`, `atr_day_bands_live`.

### Methodology (docstring lines 57–62)

- **Daily = regime/context**: ATR(14) Wilder, SMA20/50/100/200, realized vol, swings.
- **Hourly = today's trend**: SMA20/50, EMA9/21, RSI(14), MACD(12,26,9), swing structure, session VWAP when volume exists.
- **Day-range projection**: classic floor pivots from prior session OHLC + ATR bands anchored on today's open (± 0.5·ATRd inner, ± 1.0·ATRd outer).

Indicator helpers are in-file and pure: `sma`, `ema_series`, `rsi14`, `atr14`, `macd`, `swings` (lines 262–395).

## Warm-up extension

Charts must show fully-warmed indicator lines from the first visible bar, so the engine fetches **more history than it displays** (docstring lines 43–49; `main()` lines 445–456):

- **Hourly fetch = display + 21 calendar days** (`hfetch = f"{hdisp_days + 21}d"`, line 454) — ≥ ~50 warm-up hourly bars even at ~7 bars/day, enough for hourly SMA50 / RSI14 / MACD.
- **Daily fetch = one standard range up** via the `DFETCH` map (lines 448–449): `1y→2y`, `2y→5y`, etc. — so daily SMA200 is warmed before the display window.

`report_pdf.py` computes indicators on the full series and crops each chart back to its `display_days` (see `mvp-report.md`). `score_report.py` is unaffected — it filters bars to the prediction window.

## Concurrency

All network fetches (hourly, daily, each related symbol) run concurrently on a `ThreadPoolExecutor(max_workers=6)` (lines 459–462). Network-bound, stdlib threads only.

## Degraded mode

With **fewer than 24 hourly bars** but usable daily data, the run still succeeds with `degraded: "daily_only"` (lines 491–495):

- `hourly` block is `null`; intraday trend = "Insufficient data"; alignment = "unknown (no hourly data)".
- Prior/today sessions and pivots are **rebuilt from the last two DAILY bars**, tagged `"basis": "daily_bars_fallback"` (lines 535–541).
- ATR bands are anchored on the **last daily close**, tagged `"anchor": "prior_close_fallback"` (line 542).
- Freshness is still taken from hourly bars whenever any exist (honest feed-lag), daily only as last resort (lines 587–590).

In the normal path, sessions are rebuilt from **hourly** bars so boundaries are correct per asset class under `--roll-utc` (lines 521–534); if fewer than 2 hourly-built sessions exist, it falls back to daily bars too (lines 532–534).

## Exit codes

| Exit | Condition |
|---|---|
| `0` | success (including degraded `daily_only`) |
| `2` | **no usable daily data** — clear error on stderr listing the hourly/daily errors and the expected symbol formats (lines 484–489); also invalid `--anchor` value (lines 440–443) |

Degraded mode prints a `WARNING:` to stderr but exits 0 (line 495).

## Edge cases

- Yahoo rows with any `None` in O/H/L/C are skipped (lines 87–88); volume defaults to 0.
- `range_to_timedelta()` (lines 124–131) handles `max`, `Nmo`, and `Nd/w/y`.
- `_http_json()` uses a 30 s timeout and a desktop User-Agent (lines 69, 73–75).
- The degraded `daily_only` path is the documented fallback for thin/illiquid intraday feeds; the rebuilt pivots use `basis "daily_bars_fallback"` and bands `anchor "prior_close_fallback"` so downstream consumers know the provenance.

## Tests

`scripts/test_sessions_intraday.py` (run: `python scripts/test_sessions_intraday.py`) — exercises `compute_pivots_bands()` golden values (`TestComputePivotsBands`: PP/R1/R2/S1/S2 + inner/outer bands for `{h:100,l:90,c:95}`, anchor 96, ATR 4.0) and the None/division guards (no ATR → no bands; no prior → no pivots; None anchor → no bands). **Offline — the live fetch path is never touched**; only the pure math helper the `--anchor` path reuses is tested (test docstring lines 1–8).

## Related docs

- [`sessions.md`](./sessions.md) — the `--roll-utc` convention pairs with the session profiles; the scaffold uses `sessions.get_session()` for the window, `intraday`'s pivots/bands for the levels.
- [`scaffold_payload.md`](./scaffold_payload.md) — consumes `pivots_classic`, `atr_day_bands`, `hourly.swing_highs/lows`, `files.hourly_csv` (last close → `canonical.last_price`).
- [`mvp-report.md`](./mvp-report.md) / `report_pdf.py` — warm-crop charting of the extended series.
- `../confidence/` — `confidence.compute_confidence` / `compute_dq` read the analysis JSON.
