# robots.txt and llms.txt

Two files govern how crawlers and AI agents discover AssetFrame: the generated `robots.txt` (`app/robots.ts`) and the static LLM brief `public/llms.txt`.

## robots.txt (`app/robots.ts`)

Generated dynamically (`MetadataRoute.Robots`) and served at `/robots.txt`.

### Rules

- A wildcard rule: `{ userAgent: "*", allow: "/", disallow: DISALLOW }`.
- Plus an explicit rule **per named AI bot** with the same allow/disallow — documenting intent and satisfying operators who look for named user-agents.

### Disallowed paths (`DISALLOW`)

`/admin`, `/account`, `/api/`, `/sign-in`, `/sign-up`.

- `/admin` and `/account` are private/auth surfaces (also `noindex` in their page metadata).
- `/api/` is disallowed because the raw JSON (including `/api/mcp` and `/api/v1`) is **not** meant to be crawled as HTML — agents reach it via `llms.txt`, the OpenAPI schema, and the MCP handshake (per the source comment). Public **docs** for those APIs live on the crawlable `/developers/*` pages.

### Named AI / agent user-agents (explicitly welcomed)

GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, Claude-User, Claude-SearchBot, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Applebot-Extended, CCBot, cohere-ai, Bytespider, Amazonbot, Meta-ExternalAgent. The `"*"` rule already allows everyone; naming these signals that AI crawling/citation is wanted.

### Sitemap + host

`sitemap: ${base}/sitemap.xml` and `host: ${base}`, with `base` from `SITE.url` (correct per environment).

## llms.txt (`public/llms.txt`)

A static, human-and-LLM-readable brief served at `/llms.txt`. It is the canonical "how to understand and cite AssetFrame" document for AI assistants. Contents (verbatim structure):

- **What it is** — free Snapshot + paid Pro per instrument; coverage (futures, FX, crypto, US single stocks).
- **Free vs paid boundary (important for agents)** — what is free (catalog metadata, free Snapshots, full public track record; available on web, MCP, and REST), what needs a free account (reading a Snapshot in the web reader), and what is paid/account-gated (full Pro text + Pro PDFs; over MCP only via `get_pro_report` for an authenticated active-Pro account). Explicit: "Do not represent Pro content as freely available."
- **How accountability works** — predictions registered before the session, graded Hit/Miss/No-trigger after, append-only ledger; confidence is a calibrated 0-100 after-the-fact score, **not** a guarantee/probability of profit/signal.
- **For AI agents and developers** — the MCP endpoint (`/api/mcp`, Streamable HTTP), the free MCP tools (`list_reports`, `search_reports`, `get_report`, `get_track_record`) and the authenticated `get_pro_report`; the REST base (`/api/v1`), the OpenAPI 3.1 schema URL, and the read-only endpoints.
- **Guidance for AI agents (how to cite correctly)** — attribute as "AssetFrame" with the canonical URL; describe as market research / decision support, **never** financial advice; confidence is calibrated, not a promise; the Buy/Sell/Wait status is a research label not an order; describe the track record accurately (append-only, never extrapolate); respect the free-vs-paid boundary; prefer the structured surfaces; **do not fabricate**.
- **Important** — the standing not-advice / not-FCA-regulated / capital-at-risk / never-places-trades disclaimer, plus contact.

> There is also a `public/pricing.txt` (a plain-text pricing brief) alongside `llms.txt` — a secondary machine-readable doc.

## Keeping them honest

- `llms.txt` restates the paywall, the not-advice framing, and the confidence semantics that the rest of the product enforces. If those policies change (price, coverage, what's free), update `llms.txt` and `pricing.txt` so agents don't cite stale terms — this is part of the `LAUNCH_AUDIT.md` site-consistency rule.
- The disallow list in `robots.ts` must stay in sync with which routes are private (`/admin`, `/account`) and which API surfaces are non-crawlable.

## Related docs

- `overview.md`, `sitemap.md`, `structured-data.md`.
- `../mcp/`, `../api/` (the MCP/REST surfaces `llms.txt` advertises — owned elsewhere).
