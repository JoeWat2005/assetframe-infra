/* eslint-disable camelcase */
// Adds the unique key the incremental sync needs to UPSERT scored_results by report_id.
//
// Background: scripts/sync-db.mjs used to `DELETE FROM scored_results` then re-INSERT every row
// (a full replace). That was the track-record wipe foot-gun — non-transactional on the Neon HTTP
// driver, so a crash between the DELETE and the re-INSERT left the append-only track record empty,
// and a partial/empty export replaced good history with nothing. The sync is now an incremental
// upsert keyed on report_id (ON CONFLICT (report_id) DO UPDATE), which needs a unique index here.
//
// report_id ('AF-YYYYMMDD-SLUG') is unique per scored report: the outcome ledger appends exactly
// one row per closed prediction window. We use a UNIQUE INDEX (not a named table constraint) with
// a fixed name so the engine's defensive `CREATE UNIQUE INDEX IF NOT EXISTS scored_results_report_id_uniq`
// (a belt-and-suspenders for the two-repo split) and this migration converge on the SAME object.
//
// scored_results.report_id is nullable; Postgres allows multiple NULLs under a UNIQUE index, and
// the sync skips rows without a report_id, so this neither blocks nor dedupes legacy NULL rows.
// scored_results intentionally has NO FK to editions — it is the append-only track record that must
// outlive a dropped/unpublished edition (see 1750000014000_cascade-edition-open-calls.js).

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- Defensive: if any duplicate report_ids exist (they shouldn't — the ledger is append-only),
    -- keep the most recently scored row (max id) per report_id so the unique index can build.
    -- No-op on the current tables (scored_results is empty pre-launch).
    delete from scored_results a
      using scored_results b
      where a.report_id is not null
        and a.report_id = b.report_id
        and a.id < b.id;

    create unique index if not exists scored_results_report_id_uniq
      on scored_results (report_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    drop index if exists scored_results_report_id_uniq;
  `);
};
