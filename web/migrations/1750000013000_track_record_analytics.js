/* eslint-disable camelcase */
// Track-record analytics (Task T12). Purely additive, nullable columns so a re-sync can
// populate richer per-call + per-edition taxonomy without touching existing rows:
//   open_call_predictions += pred_type, verdict, setup_side   (per sub-prediction detail)
//   editions              += asset_class_key, direction_view, prediction_type,
//                            market_regime, confidence_band, social_context
//   scored_results        += conf_version, confidence_components
// Idempotent (IF NOT EXISTS) so it reconciles whatever the earlier sync-db bootstrap left.
// NOTE: shares the 1750000010000 timestamp with report-views; node-pg-migrate orders by the
// full filename, so both run (they touch disjoint tables). Down drops only what it added.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table open_call_predictions add column if not exists pred_type  text;
    alter table open_call_predictions add column if not exists verdict    text;
    alter table open_call_predictions add column if not exists setup_side text;

    alter table editions add column if not exists asset_class_key text;
    alter table editions add column if not exists direction_view  text;
    alter table editions add column if not exists prediction_type text;
    alter table editions add column if not exists market_regime   text;
    alter table editions add column if not exists confidence_band text;
    alter table editions add column if not exists social_context  jsonb;

    alter table scored_results add column if not exists conf_version          int;
    alter table scored_results add column if not exists confidence_components jsonb;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    alter table open_call_predictions drop column if exists pred_type;
    alter table open_call_predictions drop column if exists verdict;
    alter table open_call_predictions drop column if exists setup_side;

    alter table editions drop column if exists asset_class_key;
    alter table editions drop column if exists direction_view;
    alter table editions drop column if exists prediction_type;
    alter table editions drop column if exists market_regime;
    alter table editions drop column if exists confidence_band;
    alter table editions drop column if exists social_context;

    alter table scored_results drop column if exists conf_version;
    alter table scored_results drop column if exists confidence_components;
  `);
};
