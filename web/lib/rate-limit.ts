// Rate-limiting helper. Uses @upstash/ratelimit (sliding window) when the Upstash
// Redis env vars are configured; falls back to a NO-OP so the app runs without Redis.
// The Ratelimit + Redis clients are memoized at module level (one per edge invocation).

import { apiJson } from "./http";

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix epoch seconds
};

// Lazy-initialised singletons — created at most once per module lifecycle.
let _limiterCache: Map<string, unknown> | null = null;

function getCacheMap(): Map<string, unknown> {
  if (!_limiterCache) _limiterCache = new Map();
  return _limiterCache;
}

async function getLimiter(
  limit: number,
  windowSec: number
): Promise<((id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>) | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${limit}:${windowSec}`;
  const cache = getCacheMap();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) as (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
  }

  // Dynamic import so the modules are not loaded when env vars are absent
  // (avoids build-time errors in environments without the keys).
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);

  const redis = new Redis({ url, token });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    analytics: false,
  });

  const fn = (id: string) => limiter.limit(id);
  cache.set(cacheKey, fn);
  return fn;
}

/**
 * Check the rate limit for `id`. If Upstash is not configured, always returns ok:true.
 */
export async function rateLimit(
  id: string,
  opts?: { limit?: number; windowSec?: number }
): Promise<RateLimitResult> {
  const limit = opts?.limit ?? 120;
  const windowSec = opts?.windowSec ?? 60;

  const fn = await getLimiter(limit, windowSec);
  if (!fn) {
    return { ok: true, limit, remaining: limit, reset: Math.floor(Date.now() / 1000) + windowSec };
  }

  const r = await fn(id);
  return {
    ok: r.success,
    limit: r.limit,
    remaining: r.remaining,
    reset: Math.floor(r.reset / 1000), // Upstash returns ms
  };
}

/**
 * Convenience helper: run rateLimit; if the limit is exceeded, return a 429 Response
 * with standard Retry-After + RateLimit-* headers. Returns null when the request is
 * within limits.
 */
export async function rateLimitResponse(
  req: Request,
  id: string,
  opts?: { limit?: number; windowSec?: number }
): Promise<Response | null> {
  // req is in the signature for API symmetry with rateLimitResponseWithHeaders.
  void req;
  const result = await rateLimit(id, opts);
  if (result.ok) return null;
  return apiJson(
    { error: "too_many_requests", message: "Rate limit exceeded. Please slow down." },
    { status: 429 }
  );
}

/**
 * Like rateLimitResponse but attaches RateLimit-* headers to the 429.
 */
export async function rateLimitResponseWithHeaders(
  req: Request,
  id: string,
  opts?: { limit?: number; windowSec?: number }
): Promise<Response | null> {
  void req;
  const result = await rateLimit(id, opts);
  if (result.ok) return null;

  const retryAfter = String(Math.max(0, result.reset - Math.floor(Date.now() / 1000)));
  return new Response(
    JSON.stringify({ error: "too_many_requests", message: "Rate limit exceeded. Please slow down." }, null, 2),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Retry-After": retryAfter,
        "RateLimit-Limit": String(result.limit),
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(result.reset),
      },
    }
  );
}

/** Extract the first IP from x-forwarded-for (or fallback string for local dev). */
export function getRequestIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || "local";
}
