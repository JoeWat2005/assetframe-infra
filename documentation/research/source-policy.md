# Source policy — "interpret, never invent"

This is the rule the whole research layer exists to enforce, and the data-source preference order the analyst follows when gathering context.

## The hard rule

> **The AI may *interpret* news, never *invent* it.** Every factual claim used to drive a thesis must trace to a sourced, timestamped item in the research pack. An unsupported thesis claim is a build failure, not a warning.

This is stated verbatim in `scripts/research_pack.py` (the gate message: *"the AI may interpret news, never invent it"*) and is re-enforced downstream by `scaffold_payload.py` and `mvp_report.py`. It implements the project-wide instruction in `mvp/CLAUDE.md` and `.claude/skills/mvp/SKILL.md`:

- *"Never fabricate prices, news, analyst ratings, financial metrics, or capabilities. If data is unavailable, the report must say so explicitly (source audit + data-gap fields)."*

## How the rule is mechanised (three layers)

1. **`research_pack.py` — the no-invention gate.** Every item marked `used_in_thesis: true` MUST carry a non-empty source (`source_url` or named `source`) **and** a `timestamp`. A thesis item lacking either causes `die()` → **exit 2 before anything is written**. Unsourced *non-thesis* items are demoted into `source_gaps[]` rather than silently kept (they become a stated gap, not a fact). See [news-context.md](news-context.md).
2. **`scaffold_payload.py` — the claim status gate.** `_claims()` rejects any claim whose status isn't in the valid set, and rejects any `used_in_thesis` claim whose status is `unverified`/`stale`/`unavailable` (exit 2). See [claims.md](claims.md).
3. **`mvp_report.run_qa()` — the `THESIS_BLOCKED` re-check.** At render time, high-impact claims are re-validated against `THESIS_BLOCKED = {unverified, stale, unavailable}`; a blocked claim that drives the thesis aborts the build (no artifacts written).

Confidence is also affected, not just the gate: `confidence.catalyst_confidence()` scores thesis support by claim status and **downgrades** a weakly-sourced (`single-source`/`unverified`/`stale`) `used_in_thesis` claim that can't be traced to a research-pack item — and a single-source/unverified high-impact thesis triggers a **hard cap of 55** on the published confidence. See [../confidence/components.md](../confidence/components.md) and [../confidence/limitations.md](../confidence/limitations.md).

## Data-source preference order

From `mvp/CLAUDE.md` (the engine's project rules). The analyst should prefer sources in this order and label every important figure with its source and timestamp (live / delayed / prior-session):

1. **Official sources** — exchange, regulator, central bank, company, government, issuer.
2. **Project engine `scripts/intraday.py`** — OHLC, indicators, levels. Yahoo by default; `ADVISOR_DATA_PROVIDER=eodhd` + `EODHD_API_KEY` switches to the licensed feed (futures `=F` always stay on Yahoo). Always read the JSON's `freshness`, `degraded`, and `provider` blocks before trusting any number. See [../report-engine/intraday.md](../report-engine/intraday.md).
3. **Configured MCP servers (if present)** — Alpha Vantage (budget the ~25 requests/day free tier), CoinGecko (crypto, keyless).
4. **Built-in WebSearch / WebFetch** — news, macro, catalysts.
5. **`last30days` skill** — social sentiment / catalyst discovery (feeds the *optional* social pack only; subtract-only — see [../social/social-intelligence.md](../social/social-intelligence.md)).
6. **User-provided data.**
7. **If none of the above can answer, state the gap — never invent.**

## Sourcing quality is graded, not binary

The research pack tags each item `source_quality` ∈ `high|medium|low`, and the brief tags each claim with a richer status vocabulary (`confirmed`, `multiple-source`, `single-source`, `unverified`, `stale`, `unavailable`). The confidence engine weights these (`confirmed`/`multiple-source`/`official` → full credit; `single-source` → half; weaker → low). The policy is therefore: **sourced-and-strong claims may centre a thesis; single-source may support but not centre it; unverified/stale/unavailable may appear in the report as context but may never drive the thesis.** See [claims.md](claims.md) for the full vocabulary and gate.

## Commercial-data caveat

Yahoo (the default `intraday.py` provider) is unofficial and **not licensed for a commercial product**; the licensed path (`eodhd`) exists for paid use, with futures always on Yahoo. This is a launch-readiness concern noted in `README.md` §10 and `mvp/CLAUDE.md`: reports sold to paying customers should run on the compliant/licensed feed. `NOT VERIFIED` — whether the production deployment sets `ADVISOR_DATA_PROVIDER=eodhd`; to check, inspect the engine's runtime environment / how `/mvp` is invoked for paid editions.

## Related docs

- [overview.md](overview.md) — the research layer at a glance.
- [news-context.md](news-context.md) — `research_pack.py` schema, categories, and gate.
- [claims.md](claims.md) — the claim vocabulary and `THESIS_BLOCKED`.
- [../confidence/components.md](../confidence/components.md) — the catalyst component and the source-quality scores.
- [../social/social-intelligence.md](../social/social-intelligence.md) — the optional, subtract-only social signal.
