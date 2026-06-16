import "server-only";
import { timingSafeEqual } from "node:crypto";

// Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` to scheduled requests when
// CRON_SECRET is set in the project env. Fail closed: with no secret configured we reject,
// so the cron endpoint can never be triggered anonymously in production.
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // Constant-time compare (lengths must match first, else timingSafeEqual throws).
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
