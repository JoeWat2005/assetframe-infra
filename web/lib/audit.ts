import "server-only";
import { sql } from "./db";

export type AuditRow = {
  id: number; ts: string; actor: string; action: string; target: string; detail: string;
};

// Append one audit-log row. Best-effort: a logging failure must never break the action
// that triggered it (or the webhook). No-op when the DB isn't configured.
export async function logAudit(entry: {
  actor?: string | null; action: string; target?: string | null; detail?: string | null;
}): Promise<void> {
  if (!sql) return;
  try {
    await sql.query(
      `INSERT INTO admin_audit_log (actor, action, target, detail) VALUES ($1,$2,$3,$4)`,
      [entry.actor ?? null, entry.action, entry.target ?? null, entry.detail ?? null]
    );
  } catch {
    /* audit logging is best-effort */
  }
}

// Most-recent audit rows for the admin dashboard (client filters/searches over them).
export async function getAuditLog(limit = 200): Promise<AuditRow[]> {
  if (!sql) return [];
  try {
    const rows = (await sql.query(
      `SELECT id, to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS ts, actor, action, target, detail
       FROM admin_audit_log ORDER BY id DESC LIMIT $1`,
      [limit]
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id) || 0,
      ts: String(r.ts ?? ""),
      actor: String(r.actor ?? ""),
      action: String(r.action ?? ""),
      target: String(r.target ?? ""),
      detail: String(r.detail ?? ""),
    }));
  } catch {
    return [];
  }
}
