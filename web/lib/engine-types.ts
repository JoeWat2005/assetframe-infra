export type EngineState = {
  automationPaused: boolean;
  lastHeartbeatAt: string | null; // ISO string, or null if never seen
  currentRunId: string | null;
  updatedAt: string | null;
  online: boolean; // derived: heartbeat within HEARTBEAT_WINDOW_SEC of now
};

export type GenerationRequest = {
  id: string;
  requestedBy: string;
  scope: unknown; // {"assets":[...]} | {"all_due":true}
  status: string; // queued | running | done | failed | cancelled
  cancelRequested: boolean;
  runId: string;
  error: string;
  createdAt: string; // "YYYY-MM-DD HH:MI" UTC
  startedAt: string;
  finishedAt: string;
};

// The compact per-asset summary the engine writes into engine_runs.results (see the engine's
// scripts/engine_ops.summarize_manifest). Older runs predate this column and have results=null, and
// the shape may drift, so every field is optional — consumers must guard. The per-asset `status`
// vocabulary mirrors run_daily.py: generated | forecast_only (success) and needs_brief |
// brief_rejected | brief_stand_aside | qa_failed | data_error | scaffold_error | writer_unavailable |
// brief_failed (degraded).
export type EngineRunAsset = {
  asset_id?: string | null;
  ticker?: string | null;
  status?: string | null;
  report_id?: string | null;
};
export type EngineRunResults = {
  run_id?: string | null;
  mode?: string | null;
  run_date?: string | null;
  assets_selected?: number | null;
  assets_due?: number | null;
  generated?: number | null;
  needs_brief?: string[] | null;
  brief_rejected?: string[] | null;
  brief_stand_aside?: string[] | null;
  assets?: EngineRunAsset[] | null;
  job_errors?: { ticker?: string | null; errors?: unknown }[] | null;
  score?: { scored?: number; skipped?: number; errors?: number } | null;
  token_cost?: unknown;
};

export type EngineRun = {
  id: string;
  trigger: string; // schedule | manual
  scope: unknown;
  status: string; // running | done | failed
  results: EngineRunResults | null; // per-asset manifest summary (null on older runs)
  errors: string;
  logExcerpt: string;
  startedAt: string; // "YYYY-MM-DD HH:MI" UTC
  finishedAt: string;
};

// A box-control command (restart/pull/maintenance/logs/config) the admin enqueues for the OCI VM.
// The poller claims it from engine_commands and runs an allow-listed handler; result/logExcerpt
// carry the outcome back. Mirrors GenerationRequest — a second web->box channel.
export type EngineCommand = {
  id: string;
  command: string; // restart_poller | pull_latest | run_maintenance | tail_logs | set_config
  args: unknown;
  status: string; // queued | running | done | failed | cancelled
  requestedBy: string;
  cancelRequested: boolean;
  result: string; // short outcome / error summary
  logExcerpt: string; // tail of command output (e.g. tail_logs)
  createdAt: string; // "YYYY-MM-DD HH:MI" UTC
  startedAt: string;
  finishedAt: string;
};

// A graded SANDBOX BACKTEST result row — admin-only test data the engine syncs into Neon's
// backtest_results after a backtest. Never read by the public site (the live ledger is separate).
// `results` is a packed per-prediction string like "P1=Y P2=N P3=NT" (Y=Hit, N=Miss, NT=No-trigger).
export type BacktestResult = {
  reportId: string;
  ticker: string;
  instrument: string;
  assetClass: string;
  view: string;
  confidence: number | null;
  horizon: string;
  windowEnd: string; // "YYYY-MM-DD HH:MM" or whatever the engine stored
  results: string; // packed "P1=Y P2=N …"
  hits: number;
  misses: number;
  hitRate: number | null; // 0..1
  scoredAt: string;
  createdAt: string; // "YYYY-MM-DD HH:MI" UTC
};

// A single SANDBOX BACKTEST prediction row — the full per-prediction list the engine syncs into
// Neon's backtest_predictions, keyed to each backtest_results.report_id. Admin-only; never read by
// the public site. `outcome` ∈ Y (Hit) | N (Miss) | NT (No-trigger) | MANUAL | null — MANUAL/null
// for a manual prediction means an admin still needs to grade it by hand.
export type BacktestPrediction = {
  reportId: string;
  predId: string;
  ptype: string; // e.g. "close_above" — underscores become spaces in the UI
  ptext: string;
  manual: boolean;
  outcome: string | null; // Y | N | NT | MANUAL | null
  sort: number;
};
