# `sessions.py` — session profiles + window policy

`scripts/sessions.py` encodes per-venue trading-session logic and the **prediction-window policy**. AssetFrame's product is *next-session* intelligence, so the central job here is: given "now", decide whether to predict the remainder of the current session or the next full one, and return the exact UTC window bounds plus the session prose the Pro report quotes (module docstring lines 1–11).

Stdlib-only (`datetime` only, line 12). Imported by `scaffold_payload.py` (`from sessions import get_session`) and runnable standalone.

## The four profiles

`PROFILES` (lines 16–72). Each carries a `label`, a `type`, structural times, and a `prose` list copied into the Pro "Asset-session rules" section.

| Key | `type` | Session (UTC) | Notes |
|---|---|---|---|
| `cme_futures` | `futures_23h` | Sun **22:00** → Fri **21:00**; daily maintenance **21:00–22:00** Mon–Thu | CME Globex ~23h/day. Weekly close Fri 21:00; weekend gap risk realises at the Sun 22:00 reopen. Front-month continuous; roll risk flagged ~1 week to expiry. |
| `fx_spot` | `fx_24_5` | Sun **~21:05** → Fri **~21:00** | Spot FX ~24/5. Asia ~00:00–08:00, London ~07:00–16:00, NY ~12:00–21:00. Rollover ~21:00–22:15 illiquid. |
| `us_equity_rth` | `equity_rth` | pre-market **08:00–13:30** / regular **13:30–20:00** / after-hours **20:00–00:00** | Nasdaq/NYSE, EDT regime. Tradable levels = REGULAR-session unadjusted prices; extended-hours prints labelled separately. Window targets the **next REGULAR session only**. |
| `crypto_24_7` | `crypto_24_7` | 24/7, no close | Rolling windows. Perp funding 00:00/08:00/16:00 UTC noted; weekend liquidity thinner. **Never say "market close" for crypto.** |

## DST caveat

All UTC times are valid for **the current DST regime — June 2026: US on EDT**, so CME closes 21:00 UTC and FX ~21:00 UTC (docstring lines 4–6; `cme_futures` comment lines 17–18). **Re-check these bounds at DST changes** — the times are hard-coded, not computed from a tz database.

## `get_session()` — the window policy

```python
get_session(profile_key, now=None, min_remaining_min=90, friday_cutoff_min=240, holiday_dates=None)
```

Defined lines 91–204. Returns a dict with market state, session bounds, the next maintenance break, and the **prediction window** the report should target.

**Window policy (docstring lines 94–98):** target the CURRENT session only if it is open with comfortably more than `min_remaining_min` (90) left, **and** more than `friday_cutoff_min` (240) before a weekly close; otherwise target the NEXT full session. Crypto is always a rolling 24h from `now`.

### Parameters

| Param | Default | Effect |
|---|---|---|
| `profile_key` | (required) | one of the four `PROFILES` keys |
| `now` | `datetime.now(UTC)` | evaluation time; coerced to UTC (line 101) |
| `min_remaining_min` | `90` | minimum minutes left to still target the current session |
| `friday_cutoff_min` | `240` | on a Friday, minimum minutes before the weekly close to still target the current session |
| `holiday_dates` | `None` → `set()` | set of `date` objects to skip; recorded in `holidays_applied` |

### Returned fields (common)

`profile`, `market_session_type` (the label), `session_prose` (list), `holidays_applied` (sorted strings), `market_state`, `market_open_utc`, `market_close_utc`, `next_maintenance_break`, `window_label`, `window_start_utc`, `window_end_utc`. Times are formatted `%Y-%m-%d %H:%M` by `_fmt()` (lines 87–88).

### Per-type behaviour

- **`equity_rth`** (lines 110–148): `in_rth` requires weekday < 5, not a holiday, and `rth_open ≤ now < rth_close`. If in RTH with ≥ `min_remaining_min` left → `market_state="open_regular_session"`, window = now → today's close. Otherwise advance to the next non-weekend, non-holiday weekday's regular session (or "later today" if pre-market on a trading day). States: `closed_weekend_or_holiday`, `pre_market`, `open_closing_soon`, `after_hours`. `next_maintenance_break` is the "n/a — no maintenance breaks" string (pre/after-hours trade thin and are labelled).
- **`crypto_24_7`** (lines 150–160): always `market_state="open"`, `market_close_utc="none - market does not close"`, `window_label="rolling 24h from generation"`, window = now → now + 24h, `next_maintenance_break="none scheduled (venue-dependent)"`.
- **`cme_futures` / `fx_spot`** (lines 162–203): compute the next weekly close `wc` and open `wo`. **Weekend** = between the most recent Friday close and the Sunday open after it (`in_weekend`, lines 164–168). If `in_weekend`, or `remaining < min_remaining_min`, or (Friday and `remaining < friday_cutoff_min`) → target the **next full session** (Sun reopen → Mon close, end set to 21:00 UTC + 1 day), `market_state` = `closed_weekend` or `open_closing_soon`. Otherwise → `market_state="open"`, window = now → `wc`.

## Holiday handling

Pass `holiday_dates` (a set of `date` objects, **web-verified at run time** — `SKILL.md` step 4 says web-verify when within a week of one and record in metadata). For equities, both the `in_rth` test and the next-session advance skip holiday dates (lines 115, 123, 130). For futures/FX, `_skip_holidays()` (lines 172–175) advances the start past any holiday date. What was applied is always recorded in `holidays_applied` (line 107). Metadata must record what was applied (docstring lines 9–11).

## Next-session window logic (the core)

The whole point: when the current session is closed or nearly over, the report should look forward, not predict a window that's about to end. Concretely:

- Equities: a weekend/holiday or insufficient remaining time advances to the next regular session (`window_label="next regular session"`); pre-market on a trading day targets today's open.
- Futures/FX: insufficient remaining time, a Friday-cutoff breach, or the weekend advances to "next session (Sun reopen -> Mon close)".
- The `friday_cutoff_min` (240) guard is wider than the weekday `min_remaining_min` (90) so a Friday-afternoon report doesn't register a window that the weekly close cuts short.

## Maintenance break

For `cme_futures` (which has a `daily_break` of 21:00–22:00), if a Mon–Thu break falls inside the window, `next_maintenance_break` describes it; otherwise it points at the next break at/after the window end (lines 190–196). FX/crypto have no `daily_break` (None).

## Which scaffold fields it feeds

`scaffold_payload.assemble()` (lines 284–361) copies `get_session()` output into `meta.*` and into the report's session section:

- `meta.prediction_window_start_utc` / `prediction_window_end_utc` ← `window_start_utc` / `window_end_utc` (and their London-TZ twins via `to_london()`).
- `meta.market_session_type`, `meta.market_open_utc`, `meta.market_close_utc`, `meta.next_maintenance_break` ← the session fields.
- The predictions file's `window_start_utc` / `window_end_utc` ← the same fields (`main()` line 640), so the scored window matches the report window.
- `meta.report_date` derives from `window_start_utc[:10]` (line 287).
- The Pro **"Asset-session rules"** section is `session_prose` rendered as a bullet list (`build_pro()` line 473–474).

The QA gate in `mvp_report.py` requires `meta.market_session_type` and `meta.market_close_utc` to be non-empty (`ok_sess`, lines 947–949), and enforces no-lookahead (window start ≥ latest bar − 1h). See [`mvp-report.md`](./mvp-report.md).

The profile is selected via `--session-profile` or `brief.session_profile` (scaffold `main()` line 600); a missing profile is a fatal brief error. The profile also drives `taxonomy.asset_class_key()` (scaffold lines 617–618).

## Standalone use

```
python scripts/sessions.py [profile_key]   # default cme_futures
```

`__main__` (lines 207–210) prints `get_session(key)` as JSON for `now = datetime.now(UTC)`.

## Tests

`scripts/test_sessions_intraday.py` (run: `python scripts/test_sessions_intraday.py`) covers the window logic with fixed `now` values:

- `TestCrypto247` — rolling 24h on a weekend; anchor/maintenance no-op for crypto.
- `TestEquitySessions` — weekend targets next session (Mon 13:30–20:00); holiday skipped (window must not start on the holiday); pre-market targets today's 13:30; open-with-time-left targets the current session.
- `TestFuturesSessions` — Friday evening after close → next session (Sun 22:00 → Mon 21:00); midweek open targets the remainder of the current session.

The crypto-on-weekend assertions confirm `market_close_utc="none - market does not close"`, matching the never-say-close rule.

## Related docs

- [`intraday.md`](./intraday.md) — `--roll-utc` rolls the session day for pivot/band derivation; pair `--roll-utc 22` with `fx_spot`/`crypto_24_7`/`cme_futures`, no roll with `us_equity_rth`.
- [`scaffold_payload.md`](./scaffold_payload.md) — consumes `get_session()` into `meta.*` and the predictions window.
- [`mvp-report.md`](./mvp-report.md) — QA gate's session-fields and no-lookahead checks.
- `../predictions/` — `taxonomy.asset_class_key()` maps the session profile → asset class.
