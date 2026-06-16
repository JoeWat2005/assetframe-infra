# `research_pack.py` — sourced factual context

`scripts/research_pack.py` validates and structures the analyst's gathered news into the canonical research pack the rest of the pipeline checks claims against. It is the sourcing layer of the engine.

- **Source:** `C:\Users\cwatm\Desktop\advisor\mvp\scripts\research_pack.py`
- **Output:** `data/research/<NAME>_research_pack.json` (gitignored)
- **Consumed by:** `scaffold_payload.py` (binds the brief's claims to it) and `confidence.catalyst_confidence()` (a thesis claim whose source isn't in this pack is downgraded — see [../confidence/components.md](../confidence/components.md)).

## Purpose and the Python/AI boundary

The AI gathers macro / asset / earnings / calendar / regulatory / geopolitical context with **its own** web tools (WebSearch/WebFetch + official calendars, official sources first) and hands a **draft JSON** to this script. **Python does not call the web.** `research_pack.py` is the compiler/validator: it normalises the draft, enforces the no-invention gate, and writes the canonical pack. Keeping the network out of the deterministic layer makes the gate reproducible. (`social_pack.py` follows the same pattern — see [../social/social-intelligence.md](../social/social-intelligence.md).)

## CLI

```
python scripts/research_pack.py <NAME> [--in <draft.json>] \
       [--out data/research/<NAME>_research_pack.json] [--print]
```

- With **no `--in`**, the script **emits a template skeleton** (two illustrative items, one thesis + one non-thesis) so the AI has the exact shape to fill. `emitted = "template"`.
- With `--in <draft.json>`, it validates the draft and writes the clean pack (`emitted = "validated"`).
- `--print` echoes the result to stdout as well as writing it.
- **Exit codes:** `0` ok · `2` validation error (unsupported thesis claim, bad category, bad `source_quality`, empty headline, missing `items`, invalid JSON).

## Schema

```jsonc
{
  "instrument": "Apple Inc. (AAPL)",
  "generated_at_utc": "2026-06-16 13:00 UTC",
  "items": [
    {
      "category": "macro|asset|earnings|calendar|regulatory|geopolitical",
      "headline": "...",
      "summary": "...",
      "source_url": "https://...",
      "timestamp": "2026-06-15 18:30 UTC",
      "source_quality": "high|medium|low",
      "used_in_thesis": true
    }
  ],
  "source_gaps": ["options IV not sourced", "..."]
}
```

- `CATEGORIES = ("macro", "asset", "earnings", "calendar", "regulatory", "geopolitical")` — any other category is a validation error.
- `QUALITY = ("high", "medium", "low")` — `source_quality` is required and validated.
- `headline` is required and must be non-empty.

The validated output adds a `url` field mirroring `source_url` (so `confidence._claim_traced()`, which reads `item['url']`/`item['source']`, can trace a thesis claim back to this pack — see [claims.md](claims.md)) and a `counts` block: `items`, `thesis_items`, `by_category`, `source_gaps`.

## The gate (the "interpret, never invent" rule)

`validate()` enforces:

1. **Thesis items must be sourced AND timestamped.** Any item with `used_in_thesis: true` lacking a non-empty source (`source_url` or `source`) **or** a `timestamp` triggers `die()` → **exit 2** with a message naming what's missing and the rule (*"the AI may interpret news, never invent it"*). Nothing is written on failure.
2. **Unsourced non-thesis items are demoted, not kept as fact.** A non-thesis item with no source is appended to `source_gaps[]` as `"unsourced: <headline>"` — it becomes a stated gap rather than an asserted fact.
3. **Structural validation** — draft must be a JSON object; `items` must be present and a list; each item an object with a valid category, non-empty headline, and valid `source_quality`.

This is the *first* of three claim gates; the scaffold and the render-time QA re-enforce the rule downstream (see [claims.md](claims.md)).

## `source_gaps[]`

The pack carries an explicit list of what could **not** be sourced. This flows into:

- the brief (`source_gaps` / `news_context.source_gaps`), the payload `meta.source_gaps`, and the Pro **Source audit**;
- the catalyst confidence component as a small penalty (`catalyst_confidence()` applies `1.0 - 0.15 * len(gaps)` when `news_context.source_gaps` is present);
- `compute_dq()` indirectly via weak/unavailable claims.

Stating gaps explicitly is the mechanism behind the policy *"if data is unavailable, the report must say so explicitly"* (`mvp/CLAUDE.md`).

## How the analyst uses it

1. Run `research_pack.py <NAME>` with no `--in` to get the template.
2. Fill it from sourced news (official sources first), marking each item's category, source, timestamp, quality, and whether it drives the thesis.
3. Run `research_pack.py <NAME> --in <draft>` to validate + write the canonical pack (fix any exit-2 failures).
4. Write the brief, ensuring every `used_in_thesis` claim traces to a pack item.
5. `scaffold_payload.py --check` confirms the claims pass before the real build.

## Edge cases

- **Empty pack / no news** — a pack with no thesis items is valid; a purely technical edition needn't cite news (catalyst confidence stays neutral).
- **Draft not found / invalid JSON** — `die()` → exit 2 with a clear message.
- **A thesis item with a source but no timestamp** (or vice-versa) — rejected; the message lists exactly what is missing.

## Related tests

`NOT VERIFIED` — there is **no `scripts/test_research_pack.py`** in the repo. The gate's *effect* is exercised indirectly by `test_scaffold_payload.py` (the `THESIS_BLOCKED` claim gate) and `test_confidence.py` (catalyst claim-status scoring). To check / harden: add a `test_research_pack.py` asserting exit 2 when a `used_in_thesis` item lacks a source or timestamp, and that an unsourced non-thesis item lands in `source_gaps`.

## Related docs

- [overview.md](overview.md) · [source-policy.md](source-policy.md) · [claims.md](claims.md)
- [../confidence/components.md](../confidence/components.md) — the catalyst component reads this pack.
- [../report-engine/scaffold_payload.md](../report-engine/scaffold_payload.md) — binds the brief's claims to the pack.
- [../social/social-intelligence.md](../social/social-intelligence.md) — the parallel optional social pack (same Python-validates-not-fetches pattern).
