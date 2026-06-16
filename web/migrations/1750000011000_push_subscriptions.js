/* eslint-disable camelcase */
// Web Push subscriptions (Task T16). One row per browser/device push endpoint.
// `clerk_user_id` is nullable so the schema can hold anonymous subscriptions, but the
// save server-action requires login today (so in practice it's always set). `topics`
// scopes which pushes a subscription gets: 'digest' for all editions, or specific
// instrument symbols; an empty array means "digest" by default (the cron treats empty
// as opted-in to the digest). `endpoint` is unique so re-subscribing upserts in place.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists push_subscriptions (
      id            bigserial primary key,
      clerk_user_id text,
      endpoint      text not null unique,
      p256dh        text not null,
      auth          text not null,
      topics        text[] not null default '{}',
      created_at    timestamptz default now(),
      last_seen_at  timestamptz
    );
    create index if not exists push_subscriptions_user_idx on push_subscriptions (clerk_user_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`drop table if exists push_subscriptions;`);
};
