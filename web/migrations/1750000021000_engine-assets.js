/* eslint-disable camelcase */
// engine_assets — the dashboard-editable asset universe (what the engine generates reports for).
//
// This is the WEB's source of truth for the universe. The admin edits rows here (add/enable/disable/
// set publish_policy etc.); a box-control command `sync_assets` (engine_ops) pulls these rows and
// writes config/assets.json on the box — but ONLY after config_loader validates them, so a bad row
// can never replace the good config or break generation. Mirrors the config/assets.json schema
// (scripts/config_loader.py). Seeded from the current 8 assets in the same migration.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists engine_assets (
      id               text primary key,                 -- lowercase asset id (e.g. "btc")
      name             text not null,                     -- short display name ("Bitcoin")
      instrument       text not null,                     -- full instrument name
      ticker           text not null,                     -- report ticker / slug (e.g. "BTC")
      provider_symbols jsonb not null default '{}'::jsonb,-- {"yahoo":"BTC-USD","eodhd":"..."}
      asset_class      text not null,                     -- equity|crypto|fx|futures|index|commodity
      session_profile  text not null,                     -- cme_futures|fx_spot|us_equity_rth|crypto_24_7|...
      cadence          text not null,                     -- daily|weekday|trading_day|weekday_or_market_open
      timezone         text not null default 'UTC',
      roll_utc         int  not null default 0,           -- 0..23
      related          text not null default '',          -- comma list for intraday --related
      forecast_window  text not null default 'next_session',
      publish_policy   text not null default 'approval_required', -- approval_required|auto
      report_tier      text not null default 'official',
      enabled          boolean not null default true,     -- in the daily universe?
      sort_order       int not null default 0,
      updated_at       timestamptz not null default now()
    );
    create index if not exists engine_assets_enabled_idx on engine_assets (enabled);
  `);

  // Seed the current universe so the dashboard shows it immediately (idempotent — ON CONFLICT skip).
  pgm.sql(`
    insert into engine_assets
      (id, name, instrument, ticker, provider_symbols, asset_class, session_profile, cadence, timezone, roll_utc, related, forecast_window, publish_policy, report_tier, enabled, sort_order)
    values
      ('gbpusd','GBP/USD','British Pound / US Dollar','GBPUSD','{"yahoo":"GBPUSD=X","eodhd":"GBPUSD.FOREX"}','fx','fx_spot','weekday','Europe/London',22,'DX-Y.NYB,EURUSD=X','next_liquid_session','approval_required','official',true,1),
      ('gbpjpy','GBP/JPY','British Pound / Japanese Yen','GBPJPY','{"yahoo":"GBPJPY=X","eodhd":"GBPJPY.FOREX"}','fx','fx_spot','weekday','Europe/London',22,'JPY=X,EURJPY=X','next_liquid_session','approval_required','official',true,2),
      ('eurusd','EUR/USD','Euro / US Dollar','EURUSD','{"yahoo":"EURUSD=X","eodhd":"EURUSD.FOREX"}','fx','fx_spot','weekday','Europe/London',22,'DX-Y.NYB,GBPUSD=X','next_liquid_session','approval_required','official',true,3),
      ('btc','Bitcoin','Bitcoin / USD (aggregate spot)','BTC','{"yahoo":"BTC-USD"}','crypto','crypto_24_7','daily','UTC',22,'ETH-USD','rolling_24h','approval_required','official',true,4),
      ('eth','Ethereum','Ethereum / USD','ETH','{"yahoo":"ETH-USD"}','crypto','crypto_24_7','daily','UTC',22,'BTC-USD','rolling_24h','approval_required','official',true,5),
      ('aapl','Apple','Apple Inc.','AAPL','{"yahoo":"AAPL","eodhd":"AAPL.US"}','equity','us_equity_rth','trading_day','America/New_York',0,'QQQ,^VIX','next_regular_session','approval_required','official',true,6),
      ('gold','Gold','Gold (COMEX front-month future)','GOLD','{"yahoo":"GC=F"}','commodity','cme_futures','weekday_or_market_open','America/New_York',22,'DX-Y.NYB,SI=F','next_liquid_session','approval_required','official',true,7),
      ('es','S&P 500 E-mini','S&P 500 E-mini Future','ES','{"yahoo":"ES=F"}','index','cme_futures','trading_day','America/New_York',22,'^VIX,^VVIX,^VIX3M','next_regular_session','approval_required','official',true,8)
    on conflict (id) do nothing;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`drop table if exists engine_assets;`);
};
