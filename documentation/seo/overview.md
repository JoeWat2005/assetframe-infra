# SEO overview

AssetFrame is optimised for both classic search engines and **AI answer engines** (it is explicitly built to be cited by LLMs). SEO is implemented through Next.js metadata, a dynamic sitemap, an AI-bot-aware robots file, an `llms.txt`, and a rich JSON-LD graph.

## Components

| Concern | Where | Doc |
| --- | --- | --- |
| Per-page + sitewide metadata, OpenGraph, Twitter, canonical | `app/layout.tsx`, per-page `metadata` | `metadata.md` |
| Dynamic sitemap (static routes + every edition) | `app/sitemap.ts` | `sitemap.md` |
| robots.txt (AI bots welcomed; private routes blocked) + `llms.txt` | `app/robots.ts`, `public/llms.txt` | `robots-and-llms-txt.md` |
| Structured data (Organization/WebSite/SoftwareApplication/Dataset/Article/FAQPage/Breadcrumb) | `app/layout.tsx` + per-page | `structured-data.md` |

## Base-URL discipline

Every absolute URL the app emits (canonical, OpenGraph, `metadataBase`, sitemap entries, robots `host`/sitemap, JSON-LD `@id`s, Clerk redirect origins) is built from `SITE.url`, which `site.config.ts` resolves **per environment** from the re-exposed `VERCEL_*` vars: production -> `www.assetframe.co.uk`, preview -> its own `*.vercel.app`, local -> `localhost`. This guarantees previews never emit production canonicals or sitemap URLs (which would otherwise cause duplicate-content/indexing problems).

## Crawl/index policy

- Public content is indexable (`robots: { index:true, follow:true }` sitewide in `app/layout.tsx`, with `max-image-preview:large`, `max-snippet:-1`).
- Private/auth surfaces are excluded both ways: `app/robots.ts` disallows `/admin`, `/account`, `/api/`, `/sign-in`, `/sign-up`, and `/admin` + `/account` also set `robots: { index:false }` in their page metadata.
- The raw `/api/*` JSON (including `/api/mcp` and `/api/v1`) is intentionally **not** crawled — agents reach it via `llms.txt`, the OpenAPI schema, and the MCP handshake (documented in `robots.ts` and `llms.txt`).

## AI-answer-engine optimisation

This is a deliberate focus, not an afterthought:
- `app/robots.ts` names ~18 AI/agent user-agents (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, etc.) and explicitly allows them.
- `public/llms.txt` is a full LLM-facing brief: what AssetFrame is, the free-vs-paid boundary, how the track record works, the MCP/REST surfaces, and explicit "how to cite AssetFrame correctly" guidance (attribute as research/decision-support, not advice; confidence is calibrated not a promise; respect the paywall; don't fabricate).
- The `SoftwareApplication` + `Dataset` JSON-LD tells engines exactly what the product is and that it is reachable over MCP/REST.

## Related docs

- `metadata.md`, `sitemap.md`, `robots-and-llms-txt.md`, `structured-data.md`.
- `../deployment/vercel.md` (per-env URL resolution), `../analytics/tracking.md` (JSON-LD shares `layout.tsx`).
