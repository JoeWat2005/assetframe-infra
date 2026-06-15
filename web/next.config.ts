import type { NextConfig } from "next";

// Content-Security-Policy — ENFORCED (browser blocks anything not allow-listed below).
// Allow-lists cover every third party the app loads: Clerk (auth widgets, frames, images,
// telemetry, Cloudflare Turnstile bot-check), Google Analytics, Vercel Analytics/Speed
// Insights, and Cloudflare R2 (signed report-preview images). Lemon Squeezy checkout is a
// top-level navigation (window.location), so it isn't constrained here. 'unsafe-inline' is
// still permitted for scripts/styles (Next bootstrap + Clerk + Recharts/Tailwind inline
// styles); the hardened follow-up is to replace it with a per-request nonce.
// To roll back fast if something legitimate is blocked, rename the header key at the bottom
// back to "Content-Security-Policy-Report-Only" (reports violations without blocking).
// Vercel Toolbar (preview comments) loads feedback.js from vercel.live and uses Pusher for
// live updates. It only runs on PREVIEW deployments, so allow it ONLY when VERCEL_ENV is
// "preview" — production and local stay locked down exactly as before.
const isPreview = process.env.VERCEL_ENV === "preview";
const liveScript = isPreview ? " https://vercel.live" : "";
const liveConnect = isPreview ? " https://vercel.live wss://*.pusher.com https://*.pusher.com" : "";
const liveFrame = isPreview ? " https://vercel.live" : "";
const liveImg = isPreview ? " https://vercel.live https://vercel.com" : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.assetframe.co.uk https://challenges.cloudflare.com https://www.googletagmanager.com https://*.vercel-scripts.com${liveScript}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://*.assetframe.co.uk https://*.r2.cloudflarestorage.com https://www.googletagmanager.com https://www.google-analytics.com${liveImg}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.assetframe.co.uk https://clerk-telemetry.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://vitals.vercel-insights.com https://*.vercel-scripts.com${liveConnect}`,
  `frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.assetframe.co.uk https://challenges.cloudflare.com${liveFrame}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://*.lemonsqueezy.com https://*.clerk.accounts.dev https://*.clerk.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Baseline security headers applied to every response.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
