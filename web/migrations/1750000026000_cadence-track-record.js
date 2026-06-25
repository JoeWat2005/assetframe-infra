/* eslint-disable camelcase */
// Per-cadence track record + a real report_id on editions.
//   scored_results.scored_cadence -- "daily" | "weekly" | "monthly" (group the track record by period)
//   editions.scored_cadence       -- same, for the edition row
//   editions.report_id            -- the engine's report_id (AF-YYYYMMDD / AF-YYYYWww / AF-YYYYMM -TICKER).
//                                    Joins to open_calls/scored_results by VALUE instead of rebuilding the
//                                    daily-only string in SQL, so weekly/monthly editions join correctly.
//   editions.chart_intervals      -- the candle intervals the view was analysed from (display)
//   editions.forecast_window      -- the primary forecast window (display)
// All additive/nullable. A unique index on report_id enables the clean value join + upsert.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table scored_results add column if not exists scored_cadence text;
    alter table editions
      add column if not exists scored_cadence  text,
      add column if not exists report_id       text,
      add column if not exists chart_intervals jsonb,
      add column if not exists forecast_window text;
    create unique index if not exists editions_report_id_uniq on editions(report_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    drop index if exists editions_report_id_uniq;
    alter table editions
      drop column if exists scored_cadence,
      drop column if exists report_id,
      drop column if exists chart_intervals,
      drop column if exists forecast_window;
    alter table scored_results drop column if exists scored_cadence;
  `);
};
