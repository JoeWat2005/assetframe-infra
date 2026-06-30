// Flag-gated HTTP client for the box control server (behind a Cloudflare Tunnel + Access).
//
// When ASSETFRAME_CONTROL_URL + the CF-Access service token + the app bearer are ALL set, an
// allow-listed box command is delivered instantly over the tunnel (POST /control) instead of the
// ~30s Neon poll. Unconfigured -> controlConfigured() is false and callers keep using the Neon
// command queue. Secrets are read from env only — never logged, never committed.
//
// Box contract (code/assetframe-scripts/scripts/coordination/control_server.py):
//   POST /control {command,args}  -> 202 {job_id, command, status}   (async; progress over SSE)
//                                    400 {error, allowed} | 403 {error}
//   GET  /jobs/<id>               -> the job's {status,result,log,...}
// restart_poller / pull_latest act on the poller PROCESS and are excluded from /control on the box
// (control_server _RESTART_ONLY), so they always stay on the Neon path.

const url = (process.env.ASSETFRAME_CONTROL_URL ?? "").replace(/\/+$/, "");
const bearer = process.env.ASSETFRAME_CONTROL_TOKEN ?? "";
const cfId = process.env.CF_ACCESS_CLIENT_ID ?? "";
const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET ?? "";

const HTTP_INELIGIBLE = new Set(["restart_poller", "pull_latest"]);

export function controlConfigured(): boolean {
  return Boolean(url && bearer && cfId && cfSecret);
}

export function controlEligible(command: string): boolean {
  return controlConfigured() && !HTTP_INELIGIBLE.has(command);
}

// Proves the request came THROUGH Cloudflare Access (the box verifies the Cf-Access JWT the tunnel adds).
function accessHeaders(): Record<string, string> {
  return { "CF-Access-Client-Id": cfId, "CF-Access-Client-Secret": cfSecret };
}

async function timed(path: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(`${url}${path}`, { ...init, signal: ctl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export type BoxResult = { ok: boolean; id?: string; message: string };

// POST /control {command,args} -> 202 {job_id}. The box runs it asynchronously; the job id lets the
// UI poll /jobs/<id> (or follow SSE). On any non-202 / network error, ok=false so the caller can fall
// back to the durable Neon queue.
export async function boxControl(command: string, args: Record<string, unknown>): Promise<BoxResult> {
  try {
    const res = await timed("/control", {
      method: "POST",
      headers: { ...accessHeaders(), Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({ command, args }),
    });
    if (res.status === 202) {
      const j = (await res.json().catch(() => ({}))) as { job_id?: string };
      return { ok: true, id: j.job_id, message: "Sent to the box." };
    }
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: `Box rejected the command (${res.status})${j.error ? `: ${j.error}` : ""}.` };
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    return { ok: false, message: timeout ? "Box did not respond (timeout)." : "Could not reach the box." };
  }
}

// GET /jobs/<id> -> the job record, or null on error / unknown id.
export async function boxJob(id: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await timed(`/jobs/${encodeURIComponent(id)}`, { headers: accessHeaders() });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Poll a box job until it reaches a terminal state (done/failed) or the timeout elapses, so the
// dashboard can show the real result inline. Quick commands finish in <2s; long ones (run_backtest,
// run_maintenance) hit the timeout and just report "running" — they keep going on the box.
export async function waitForBoxJob(id: string, timeoutMs = 12_000): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    last = await boxJob(id);
    const st = last?.status;
    if (st === "done" || st === "failed") return last;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return last;
}

// GET /status -> the box snapshot (online/paused/current-run + runs + requests + commands + schedule),
// or null when the control plane is unconfigured / the box is unreachable (caller falls back to Neon).
export async function boxStatus(): Promise<Record<string, unknown> | null> {
  if (!controlConfigured()) return null;
  try {
    const res = await timed("/status", { headers: accessHeaders() }, 8000);
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
