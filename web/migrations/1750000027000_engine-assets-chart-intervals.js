/* eslint-disable camelcase */
// Per-asset candle intervals the engine analyses (mirrors scripts/config_loader.CHART_INTERVALS).
// Distinct from `timeframes` (forecast/scoring windows): these are the charts the directional view
// is built FROM (60m/2h/4h/8h/1d/1week/1month). Default ["60m","1d"] keeps existing rows unchanged.
// The box sync (engine_ops._sync_assets_from_neon) reads this and passes --chart-intervals to intraday.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table engine_assets
      add column if not exists chart_intervals jsonb not null default '["60m","1d"]'::jsonb;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    alter table engine_assets drop column if exists chart_intervals;
  `);
};
