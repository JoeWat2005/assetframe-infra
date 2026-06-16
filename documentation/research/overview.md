# Research layer — overview

The research layer is how factual, sourced context enters an AssetFrame edition **without the AI being trusted to invent it**. It sits between the engine's numbers (`intraday.py`) and the analyst's brief, and it is the gate the rest of the pipeline checks the brief's claims against.

The V2 principle that governs this layer:

> **The AI may *interpret* news, but it must never *invent* it.** Every factual claim that drives a thesis must trace to a sourced, timestamped item; if it can't, the build fails before anything ships.

## What lives here

| Concern | Script | Output (gitignored) | Doc |
|---|---|---|---|
| Sourced factual context (macro / asset / earnings / calendar / regulatory / geopolitical) | `scripts/research_pack.py` | `data/research/<NAME>_research_pack.json` | [news-context.md](news-context.md) |
| The data-source preference order + "interpret, never invent" rule | (policy, enforced across the pipeline) | — | [source-policy.md](source-policy.md) |
| The brief's `claims[]` and the `THESIS_BLOCKED` gate | `scripts/research_pack.py`, `scripts/scaffold_payload.py`, `scripts/mvp_report.py` | — | [claims.md](claims.md) |

Note: `research_memory.py` (reasoning-level learning derived from the ledger) is named "research memory" but belongs to the **ledger** feedback loop, not this layer — see [../ledger/calibration.md](../ledger/calibration.md) and [../ledger/overview.md](../ledger/overview.md). This layer is about *sourced news for the current edition*, not learning from past outcomes.

## Where it fits in the pipeline

```
intraday.py ─┐
research_pack.py (sourced factual context) ─┤
social_pack.py (OPTIONAL, subtract-only)   ─┼─► ledger_context.py ─► AI writes the research brief
                                            │                          │
                                            │   (claims[] must trace ───┘
                                            │    to the research pack)
                                            ▼
                                  scaffold_payload.py ──► confidence.py (catalyst component)
                                            │
                                            ▼
                                     mvp_report.py (QA: THESIS_BLOCKED re-check)
```

The research pack is consumed in three places:

1. **The analyst** reads it before writing the brief and may only interpret items that are in it.
2. **`scaffold_payload.py`** rejects a brief whose `used_in_thesis` claims are `unverified`/`stale`/`unavailable` (see `_claims()` in `scaffold_payload.py`, which calls `die()` → exit 2).
3. **`confidence.catalyst_confidence()`** scores thesis support against the pack, and **downgrades** a weakly-sourced thesis claim that isn't traceable to a pack item (see [../confidence/components.md](../confidence/components.md)).
4. **`mvp_report.run_qa()`** re-checks high-impact claims against the same rule (`THESIS_BLOCKED = {unverified, stale, unavailable}`) and aborts the build if a blocked claim drives the thesis.

## Key property: Python validates, it does not fetch

`research_pack.py` is a **validator/normaliser, not a web client**. The AI gathers news with its own tools (WebSearch/WebFetch, official calendars) and hands a *draft* JSON to the script; the script enforces the no-invention gate and writes the canonical pack. This keeps the "compiler/validator" boundary intact: the deterministic Python layer never makes a network call for research, so the gate is reproducible. The same pattern is used by `social_pack.py` (see [../social/overview.md](../social/overview.md)).

## Optionality

The research pack is expected for any edition with a news-driven thesis, but a **clean technical call needn't cite news**: `confidence.catalyst_confidence()` treats the *absence* of catalysts as neutral (0.5), not low. The social pack is fully optional and subtract-only (see [../social/](../social/overview.md)).

## Related tests

There is **no dedicated `scripts/test_research_pack.py`** in the repo (verified: the `scripts/test_*.py` set is `test_firewall`, `test_confidence`, `test_calibrate`, `test_score_report`, `test_ledger_context`, `test_scaffold_payload`, `test_sessions_intraday`, `test_taxonomy`, `test_social_posts`). The research-pack gate is, however, indirectly exercised by `test_scaffold_payload.py`, which tests the `THESIS_BLOCKED` claim gate at the scaffold layer, and by `test_confidence.py`, which covers the catalyst component's claim-status scoring.

`NOT VERIFIED` — no unit test asserts `research_pack.validate()` exit-2 behaviour directly. To check / add coverage: write a `test_research_pack.py` that feeds a `used_in_thesis` item missing a source or timestamp and asserts a non-zero exit.

## Related docs

- [source-policy.md](source-policy.md) — the data-source preference order and the interpret-never-invent rule.
- [claims.md](claims.md) — the claim vocabulary and the `THESIS_BLOCKED` gate end to end.
- [news-context.md](news-context.md) — `research_pack.py` in full (schema, categories, gate, CLI).
- [../confidence/components.md](../confidence/components.md) — how the catalyst component scores the pack.
- [../report-engine/scaffold_payload.md](../report-engine/scaffold_payload.md) — where the brief's claims are rejected.
- [../social/overview.md](../social/overview.md) — the parallel, subtract-only social layer.
