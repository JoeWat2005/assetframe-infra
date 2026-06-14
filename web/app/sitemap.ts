import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/content";
import { SITE } from "@/site.config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");
  const staticRoutes = ["", "/reports", "/track-record", "/pricing", "/how-it-works", "/faq", "/about", "/contact", "/terms", "/privacy"].map(
    (p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })
  );

  let editions: MetadataRoute.Sitemap = [];
  try {
    editions = (await getCatalog()).map((e) => ({
      url: `${base}/reports/${e.date}/${e.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    /* DB unavailable at build — static routes are enough */
  }
  return [...staticRoutes, ...editions];
}
