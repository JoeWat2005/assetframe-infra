// Central site config. Edit socials/brand here. Secrets come from env (never here).
export const SITE = {
  brand: "AssetFrame",
  tagline: "Next-session market intelligence, scored after the fact.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://assetframe.co.uk",
  // Lemon Squeezy buy link + price label (public, safe to expose). Env overrides the default.
  checkoutUrl:
    process.env.NEXT_PUBLIC_CHECKOUT_URL ||
    "https://assetframe.lemonsqueezy.com/checkout/buy/2b3067fc-8b2c-4f45-b709-e2d28ae448d1",
  proPrice: process.env.NEXT_PUBLIC_PRO_PRICE || "£9.99/month",
  contactEmail: "hello@assetframe.co.uk",
  // Homepage countdown — when the next batch of editions is generated. Honest + configurable.
  // cadence "daily" counts to the next hourUTC; "weekly" counts to weekdayUTC at hourUTC.
  publish: {
    cadence: "daily" as "daily" | "weekly",
    hourUTC: 6, // 06:00 UTC ≈ 07:00 London, ahead of the session
    weekdayUTC: 1, // 0=Sun … 6=Sat (used only when cadence === "weekly")
    label: "New editions publish daily at 06:00 UTC",
  },
  // Where the admin "Analytics" card sends you. Set to your Vercel project's Analytics tab.
  analyticsUrl: process.env.NEXT_PUBLIC_ANALYTICS_URL || "https://vercel.com/dashboard",
  // Social links — fill in your handles (leave "" to hide an icon)
  socials: {
    x: "https://x.com/assetframe",
    linkedin: "https://www.linkedin.com/company/assetframe",
    youtube: "",
    reddit: "",
    instagram: "",
  },
  disclaimer:
    "AssetFrame publishes general market research and decision-support analysis. It is " +
    "not investment advice and not a personal recommendation — we do not tell anyone to " +
    "buy or sell. Markets are uncertain and you can lose money. No outcome is guaranteed. " +
    "Do your own research and consider an FCA-authorised adviser. AssetFrame never places trades.",
};

export type SocialKey = keyof typeof SITE.socials;
