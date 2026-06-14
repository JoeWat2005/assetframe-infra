/* eslint-disable camelcase */
// Admin + billing audit log. One row per privileged or billing action (grant/revoke Pro,
// content revalidation, and webhook grant/revoke/unresolved), giving the admin dashboard a
// searchable activity trail. Holds no new PII beyond the email already stored in Clerk.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists admin_audit_log (
      id      bigserial primary key,
      ts      timestamptz not null default now(),
      actor   text,           -- who performed it: admin email, or 'webhook'
      action  text not null,  -- grant_pro | revoke_pro | revalidate | billing_grant | billing_revoke | grant_unresolved
      target  text,           -- affected member email / subscription id
      detail  text            -- freeform context
    );
    create index if not exists admin_audit_log_ts_idx     on admin_audit_log (ts desc);
    create index if not exists admin_audit_log_target_idx on admin_audit_log (target);
    create index if not exists admin_audit_log_action_idx on admin_audit_log (action);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`drop table if exists admin_audit_log;`);
};
