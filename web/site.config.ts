// Central site config. Edit socials/brand here. Secrets come from env (never here).

// Base URL for every ABSOLUTE link the app emits (canonical, OpenGraph, metadataBase,
// sitemap, robots host, JSON-LD, Clerk redirect origins). In-app navigation uses relative
// <Link href="/..."> and already resolves to whatever domain you're on, so this only governs
// absolute URLs. Resolves per environment (NEXT_PUBLIC_VERCEL_* are re-exposed in next.config):
//   production  -> NEXT_PUBLIC_SITE_URL override, else the project's production domain, else www.
//   preview     -> the deployment's own Vercel URL (so previews never claim to be prod).
//   local dev   -> NEXT_PUBLIC_SITE_URL (http://localhost:3000) or the localhost default.
function resolveSiteUrl(): string {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (env === "production") {
    if (explicit) return explicit;
    const prod = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    return prod ? `https://${prod}` : "https://www.assetframe.co.uk";
  }
  if (env === "preview") {
    const u = process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
    if (u) return `https://${u}`;
  }
  return explicit || "http://localhost:3000";
}

export const SITE = {
  brand: "AssetFrame",
  tagline: "Next-session market intelligence, scored after the fact.",
  url: resolveSiteUrl(),
  // Lemon Squeezy buy link + price label (public, safe to expose). Env overrides the default.
  checkoutUrl:
    process.env.NEXT_PUBLIC_CHECKOUT_URL ||
    "https://assetframe.lemonsqueezy.com/checkout/buy/2b3067fc-8b2c-4f45-b709-e2d28ae448d1",
  proPrice: process.env.NEXT_PUBLIC_PRO_PRICE || "£9.99/month",
  contactEmail: "contact@assetframe.co.uk",
  // Lemon Squeezy Customer Portal — universal self-serve cancel/billing via an email
  // magic-link. Always works (no API key needed); used when we don't yet have a
  // per-subscription portal URL from the webhook.
  lemonPortalUrl: process.env.NEXT_PUBLIC_LEMON_PORTAL_URL || "https://app.lemonsqueezy.com/my-orders",
  // Homepage countdown — when the next batch of editions is generated. Honest + configurable.
  // Times are in `tz`; with tz "UTC" the countdown targets a fixed 06:00 UTC daily (DST-free).
  // cadence "daily" counts to the next hourLocal; "weekly" counts to weekdayLocal at hourLocal.
  publish: {
    cadence: "daily" as "daily" | "weekly",
    tz: "UTC",
    hourLocal: 6, // 06:00 UTC — pre-London-open (LSE opens 08:00 London ≈ 07:00 UTC)
    weekdayLocal: 1, // 0=Sun … 6=Sat (used only when cadence === "weekly")
    label: "New editions publish daily at 06:00 UTC",
  },
  // Where the admin "Analytics" cards send you. Set these to your own dashboards.
  analyticsUrl: process.env.NEXT_PUBLIC_ANALYTICS_URL || "https://vercel.com/dashboard",
  gaUrl: process.env.NEXT_PUBLIC_GA_URL || "https://analytics.google.com/",
  // Social links — fill in your handles (leave "" to hide an icon)
  socials: {
    x: "https://x.com/AssetFrame",
    linkedin: "https://www.linkedin.com/company/129704266",
    youtube: "",
    reddit: "",
    instagram: "",
  },
  disclaimer:
    "AssetFrame publishes general market research and decision-support analysis. It is " +
    "not investment advice and not a personal recommendation. We do not tell anyone to " +
    "buy or sell. Markets are uncertain and you can lose money. No outcome is guaranteed. " +
    "Do your own research and consider an FCA-authorised adviser. AssetFrame never places trades.",
};

export type SocialKey = keyof typeof SITE.socials;
