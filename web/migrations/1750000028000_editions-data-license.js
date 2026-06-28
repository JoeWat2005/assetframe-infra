/* eslint-disable camelcase */
// Data-license provenance on editions (additive, nullable). The engine records which price
// provider produced an edition and under what license terms, so the public reader can show a
// subtle provenance line:
//   data_provider          text     — the data source used (e.g. yahoo, twelvedata, coingecko)
//   data_license           text     — 'personal' | 'commercial' (the license mode it ran under)
//   data_license_degraded  boolean  — true if it fell back to a non-commercial source despite a
//                                       commercial license request (so the UI can flag it)
// Idempotent (IF NOT EXISTS); existing rows keep NULL / false. Down drops exactly what up added.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    alter table editions add column if not exists data_provider         text;
    alter table editions add column if not exists data_license          text;
    alter table editions add column if not exists data_license_degraded boolean default false;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    alter table editions drop column if exists data_provider;
    alter table editions drop column if exists data_license;
    alter table editions drop column if exists data_license_degraded;
  `);
};
