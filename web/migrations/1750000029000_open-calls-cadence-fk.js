/* eslint-disable camelcase */
// Repoint the open_calls -> editions foreign key from the DAILY-format generated column
// `report_ref` (AF-YYYYMMDD-slug, from 1750000014000) to the engine's REAL cadence-aware
// `report_id` (AF-YYYYMMDD / AF-YYYYWww / AF-YYYYMM -TICKER, added in 1750000026000).
//
// Why: the old FK silently FK-dropped every WEEKLY/MONTHLY open_call on sync, because a cadence
// report_id (e.g. AF-2026W26-GBPUSD) matches no daily report_ref. Latent today (all assets are
// daily, and for a daily report report_id == the report_ref value), so this is a no-op for the
// current universe and makes weekly/monthly cadence safe before such an asset is added.
//
// Notes:
//   * report_id is the FK TARGET, so it needs a UNIQUE CONSTRAINT (a bare unique index is not a
//     valid FK target). 1750000026000 created a unique INDEX `editions_report_id_uniq`; promote it
//     to a constraint in place when present, else create one.
//   * report_id is nullable (legacy editions may be NULL) and the FK is added NOT VALID, so adding
//     it can never fail on pre-existing rows; new/updated rows are still enforced.
//   * report_ref + editions_report_ref_uniq are intentionally LEFT in place (cheap generated column)
//     so `down` can restore the original FK.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'editions_report_id_uniq_c') then
        if exists (select 1 from pg_class where relname = 'editions_report_id_uniq' and relkind = 'i') then
          alter table editions add constraint editions_report_id_uniq_c unique using index editions_report_id_uniq;
        else
          alter table editions add constraint editions_report_id_uniq_c unique (report_id);
        end if;
      end if;
    end $$;

    alter table open_calls drop constraint if exists open_calls_edition_fk;
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'open_calls_edition_fk') then
        alter table open_calls
          add constraint open_calls_edition_fk
          foreign key (report_id) references editions(report_id) on delete cascade not valid;
      end if;
    end $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    alter table open_calls drop constraint if exists open_calls_edition_fk;
    do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'open_calls_edition_fk') then
        alter table open_calls
          add constraint open_calls_edition_fk
          foreign key (report_id) references editions(report_ref) on delete cascade;
      end if;
    end $$;
    alter table editions drop constraint if exists editions_report_id_uniq_c;
  `);
};
