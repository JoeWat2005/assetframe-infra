/* eslint-disable camelcase */
// Engine command queue — the second web->box control channel (after generation_requests).
//
// The OCI VM has no inbound ports, so admin "control the box" actions (restart the poller, pull
// latest code, run maintenance, fetch logs, set an allow-listed config value) are ENQUEUED here as
// allow-listed commands. The poller claims and executes them on its normal Neon-polling cadence —
// engine_ops.claim_next_command() (a copy of claim_next_request's SELECT ... FOR UPDATE SKIP LOCKED)
// + run_command() dispatching on an allow-list — exactly like generation_requests. The command name
// is validated against the allow-list on BOTH sides (web enqueue + box execute); the box never runs
// an unknown verb. cancel_requested is a co-operative flag (the box can't be force-killed from here).
// result + log_excerpt carry the outcome back to the admin console. Modeled on 1750000017000_engine-ops.js.

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    create table if not exists engine_commands (
      id               text primary key,
      command          text not null,
      args             jsonb not null default '{}'::jsonb,
      status           text not null default 'queued',   -- queued | running | done | failed | cancelled
      requested_by     text,
      cancel_requested boolean not null default false,
      result           text,                              -- short outcome / error summary
      log_excerpt      text,                              -- tail of command output (e.g. tail_logs)
      created_at       timestamptz not null default now(),
      started_at       timestamptz,
      finished_at      timestamptz
    );
    create index if not exists engine_commands_status_created_idx
      on engine_commands (status, created_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    drop table if exists engine_commands;
  `);
};
