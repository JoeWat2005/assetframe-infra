// The ONLY valid report object keys are <date>/<slug>/(free|pro).(html|pdf) and
// <date>/<slug>/preview.png. The anchored allow-list blocks path traversal (../),
// query strings, alternate separators, and any other object from being requested.
// Free assets (free.*, preview.png) require sign-in; Pro assets (pro.*) require a
// subscription — the caller classifies the key and gates accordingly.
const PRO_RE = /^\d{4}-\d{2}-\d{2}\/[A-Za-z0-9_-]+\/pro\.(html|pdf)$/;
const FREE_RE = /^\d{4}-\d{2}-\d{2}\/[A-Za-z0-9_-]+\/(?:free\.(?:html|pdf)|preview\.png)$/;

export type ReportTier = "free" | "pro";

export function classifyReportKey(key: string): ReportTier | null {
  if (PRO_RE.test(key)) return "pro";
  if (FREE_RE.test(key)) return "free";
  return null;
}
