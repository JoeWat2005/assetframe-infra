// The ONLY valid report object keys are <date>/<slug>/(free|pro).(html|pdf) and
// <date>/<slug>/preview.png, with a calendar-plausible date. The anchored allow-list
// blocks path traversal (../), query strings, alternate separators, and any other object.
// Free assets (free.*, preview.png) require sign-in; Pro assets (pro.*) require a
// subscription — the caller classifies the key and gates accordingly. The patterns are
// linear (anchored, no nested quantifiers) so they are not ReDoS-prone.
const DATE = String.raw`\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])`;
const SLUG = String.raw`[A-Za-z0-9_-]+`;
const PRO_RE = new RegExp(`^${DATE}/${SLUG}/pro\\.(?:html|pdf)$`);
const FREE_RE = new RegExp(`^${DATE}/${SLUG}/(?:free\\.(?:html|pdf)|preview\\.png)$`);

export type ReportTier = "free" | "pro";

export function classifyReportKey(key: string): ReportTier | null {
  if (PRO_RE.test(key)) return "pro";
  if (FREE_RE.test(key)) return "free";
  return null;
}
