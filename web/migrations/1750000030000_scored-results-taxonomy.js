/* eslint-disable camelcase */
// Denormalize the scored row's taxonomy onto scored_results so the public track-record
// breakdowns (by asset class / prediction type / market regime) group directly off the
// scored row — instead of joining editions for asset_class_key/prediction_type/market_regime,
// columns the engine NEVER populates (so the DB-path breakdowns were always empty; only the
// JSON fallback carried them). The engine's append-only outcome ledger already records all
// three per scored row (ledger_db.py); export_content.py now emits them and sync-db.mjs
// writes them here. Cadence-agnostic, survives an edition being un-published, and lets the
// fragile editions taxonomy columns be dropped in the schema flush. All additive/nullable.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table scored_results
      add column if not exists asset_class   text,
      add column if not exists pred_type     text,
      add column if not exists market_regime text;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    alter table scored_results
      drop column if exists asset_class,
      drop column if exists pred_type,
      drop column if exists market_regime;
  `);
};
