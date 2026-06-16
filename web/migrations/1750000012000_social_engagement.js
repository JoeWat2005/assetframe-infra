/* eslint-disable camelcase */
// Social engagement metrics (Task T17) — MARKETING-ONLY distribution data.
//
// One row per captured metrics snapshot for a published-and-distributed post
// (the drafts come from scripts/social_posts.py; posting itself stays human-gated).
// post_ref is the platform's own id/url for the post; report_id ("<date>/<slug>")
// links a snapshot back to the edition it promoted (nullable — brand posts have none).
//
// FIREWALL: this is a distribution feedback loop for marketing only. NOTHING in the
// research / confidence / ledger scoring path reads this table or the engagement lib —
// see scripts/test_firewall.py. Engagement must never feed back into a report's
// confidence, bias, or scoring.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists social_engagement (
      id           bigserial primary key,
      platform     text not null,   -- 'x' | 'linkedin' | 'newsletter' | 'reddit' | ...
      post_ref     text,            -- platform's own post id/url
      report_id    text,            -- "<date>/<slug>"; nullable for brand posts
      impressions  int default 0,
      engagements  int default 0,
      clicks       int default 0,
      captured_at  timestamptz default now()
    );
    create index if not exists social_engagement_report_idx on social_engagement (report_id);
    create index if not exists social_engagement_captured_idx on social_engagement (captured_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`drop table if exists social_engagement;`);
};
