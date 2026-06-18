/* eslint-disable camelcase */
// Programmatic API key store. Each key is identified by a sha256 hex hash stored in
// key_hash (high-entropy random secret → sha256 is sufficient). The full key is NEVER
// persisted — only the hash and a short display prefix. key_hash has a UNIQUE constraint
// so a duplicate key (astronomically unlikely) fails loud rather than silently shadowing.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists api_keys (
      id              text primary key,
      clerk_user_id   text not null,
      name            text,
      key_prefix      text not null,
      key_hash        text not null unique,
      created_at      timestamptz default now(),
      last_used_at    timestamptz,
      revoked_at      timestamptz
    );
    create index if not exists api_keys_hash_idx on api_keys (key_hash);
    create index if not exists api_keys_user_idx on api_keys (clerk_user_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    drop table if exists api_keys;
  `);
};
