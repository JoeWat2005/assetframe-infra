import type { MetadataRoute } from "next";
import { SITE } from "@/site.config";

// Private/auth surfaces that must stay out of every crawler's index. Public API docs live
// on /developers/*; the raw /api/* JSON (incl. /api/mcp and /api/v1) is intentionally not
// crawled — agents reach it via llms.txt, the OpenAPI schema and the MCP handshake.
const DISALLOW = ["/admin", "/account", "/api/", "/sign-in", "/sign-up"];

// Major AI / LLM crawlers and agent user-agents we explicitly welcome so AssetFrame can be
// discovered and correctly cited in AI answers and AI Overviews. The "*" rule already allows
// everyone; naming these documents intent and is what some operators look for.
const AI_BOTS = [
  "GPTBot", // OpenAI training crawler
  "OAI-SearchBot", // ChatGPT search index
  "ChatGPT-User", // ChatGPT browsing on a user's behalf
  "ClaudeBot", // Anthropic crawler
  "Claude-Web", // Anthropic (legacy UA)
  "Claude-User", // Claude browsing on a user's behalf
  "Claude-SearchBot", // Claude search index
  "anthropic-ai", // Anthropic
  "PerplexityBot", // Perplexity index
  "Perplexity-User", // Perplexity user-initiated fetch
  "Google-Extended", // Gemini / Vertex AI training
  "Googlebot", // Google Search (also feeds AI Overviews)
  "Applebot-Extended", // Apple Intelligence
  "CCBot", // Common Crawl (feeds many LLMs)
  "cohere-ai", // Cohere
  "Bytespider", // ByteDance / Doubao
  "Amazonbot", // Amazon
  "Meta-ExternalAgent", // Meta AI
];

// Allow every crawler (incl. classic search engines and any AI bot not named below) plus an
// explicit welcome for the major AI/agent user-agents — while keeping private and auth
// surfaces out of every index.
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
