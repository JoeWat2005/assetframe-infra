// The ONLY valid report object keys are <date>/<slug>/(free|pro).(html|pdf) and
// <date>/<slug>/preview.png, with a calendar-plausible date. The anchored allow-list
// blocks path traversal (../), query strings, alternate separators, and any other object.
// Tiers: pro.* needs a subscription, free.* needs sign-in, preview.png is public (a
// marketing thumbnail). The patterns are linear (anchored, no nested quantifiers) so
// they are not ReDoS-prone.
const DATE = String.raw`\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])`;
const SLUG = String.raw`[A-Za-z0-9_-]+`;
const PRO_RE = new RegExp(`^${DATE}/${SLUG}/pro\\.(?:html|pdf)$`);
const FREE_RE = new RegExp(`^${DATE}/${SLUG}/free\\.(?:html|pdf)$`);
const PREVIEW_RE = new RegExp(`^${DATE}/${SLUG}/preview\\.png$`);

export type ReportTier = "public" | "free" | "pro";

export function classifyReportKey(key: string): ReportTier | null {
  if (PRO_RE.test(key)) return "pro";
  if (FREE_RE.test(key)) return "free";
  if (PREVIEW_RE.test(key)) return "public";
  return null;
}

// The (date, slug) pair that identifies a report edition, validated with the SAME anchored
// date + slug grammar as the object keys above. Used by the public REST API and the MCP
// tools to reject malformed input before it reaches the data layer (defence in depth — the
// DB lookups are already parameterized, but this stops path-traversal/garbage slugs and
// over-long inputs from ever hitting a query). Linear/anchored, so not ReDoS-prone.
const DATE_RE = new RegExp(`^${DATE}$`);
const SLUG_RE = new RegExp(`^${SLUG}$`);
const SLUG_MAX = 64;

export function isValidReportRef(date: string, slug: string): boolean {
  return (
    typeof date === "string" &&
    typeof slug === "string" &&
    slug.length <= SLUG_MAX &&
    DATE_RE.test(date) &&
    SLUG_RE.test(slug)
  );
}
