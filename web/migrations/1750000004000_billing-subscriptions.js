/* eslint-disable camelcase */
// Durable Lemon Squeezy subscription -> Clerk-user mapping. The webhook resolves the
// account from this table on EVERY event, so revokes/refunds find the right user even
// after they change their email (email-only resolution fails open on revoke). Also stores
// the last applied event timestamp for idempotency / out-of-order protection.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists billing_subscriptions (
      subscription_id text primary key,
      ls_customer_id  text,
      clerk_user_id   text not null,
      status          text,
      updated_at      text,          -- LS event updated_at (ISO); used for staleness checks
      created_at      timestamptz not null default now()
    );
    create index if not exists billing_subscriptions_user_idx     on billing_subscriptions (clerk_user_id);
    create index if not exists billing_subscriptions_customer_idx on billing_subscriptions (ls_customer_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`drop table if exists billing_subscriptions;`);
};
