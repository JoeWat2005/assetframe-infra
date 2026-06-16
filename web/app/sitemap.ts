import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/content";
import { SITE } from "@/site.config";

// Public routes with crawl hints tiered by how often each page changes and how important it
// is. New editions publish daily, so the reports index and track record refresh daily; the
// product/developer pages are weekly; legal/static pages are monthly. Private/auth routes
// (/admin, /account, /sign-in, /sign-up) are intentionally absent — robots.ts disallows them.
type Freq = "daily" | "weekly" | "monthly";
const ROUTES: { path: string; changeFrequency: Freq; priority: number }[] = [
  { path: "", changeFrequency: "daily", priority: 1.0 },
  { path: "/reports", changeFrequency: "daily", priority: 0.9 },
  { path: "/track-record", changeFrequency: "daily", priority: 0.9 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/how-it-works", changeFrequency: "weekly", priority: 0.7 },
  { path: "/developers", changeFrequency: "weekly", priority: 0.7 },
  { path: "/developers/mcp", changeFrequency: "weekly", priority: 0.7 },
  { path: "/developers/api", changeFrequency: "weekly", priority: 0.7 },
  { path: "/faq", changeFrequency: "weekly", priority: 0.6 },
  { path: "/reviews", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
  { path: "/feedback", changeFrequency: "monthly", priority: 0.4 },
  { path: "/accessibility", changeFrequency: "monthly", priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();
  const staticRoutes = ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let editions: MetadataRoute.Sitemap = [];
  try {
    editions = (await getCatalog()).map((e) => ({
      url: `${base}/reports/${e.date}/${e.slug}`,
      lastModified: e.reportDate ? new Date(e.reportDate) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {
    /* DB unavailable at build — static routes are enough */
  }
  return [...staticRoutes, ...editions];
}
