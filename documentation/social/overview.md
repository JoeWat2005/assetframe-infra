# Social layer — overview

The social layer covers two **separate, optional** concerns that the V2 principle deliberately keeps weak and non-authoritative:

1. **Social intelligence (input)** — `scripts/social_pack.py` summarises the *market conversation* (sentiment, crowding, hype) for an edition. It is **optional** and **subtract-only**: it can only *reduce* confidence, never raise it, and is never a factual source. See [social-intelligence.md](social-intelligence.md).
2. **Social distribution (output)** — `scripts/social_posts.py` templates marketing copy from a published edition. It **never posts**, expresses confidence only as a band, and runs a safe-wording QA gate that rejects pump/advice language. See [distribution.md](distribution.md).

The two share the word "social" but sit at opposite ends of the pipeline (one feeds the confidence engine; one is downstream of publishing) and are firewalled from each other.

## The V2 stance on social

> **Social = optional + subtract-only.** The pipeline runs normally with no social data; social may only *reduce* confidence, never raise it, and is never a factual source. Always label it "market conversation", never fact.

This is enforced mechanically, not editorially:

| Guarantee | Where it lives |
|---|---|
| Pipeline runs without social | `scaffold_payload.py` passes `social=None`; `confidence.social_adjustment(None)` returns `0.0` |
| Social can only subtract | `confidence.social_adjustment()` returns a penalty in `-10..0` (`max(-10.0, pen)`); it is added, never used to raise the blend |
| Social is never a factual source | `social_pack.py` validates sentiment only and never asserts facts; the brief's claims gate (research layer) is the only factual path |
| Social must read as "market conversation" | `mvp_report.run_qa()` warns if social-signal language appears in Pro sections without a "market conversation"/"sentiment context"/"soft signal" frame |
| Marketing metrics never reach scoring | `scripts/test_firewall.py` (see below) |

## The marketing/scoring firewall

`scripts/test_firewall.py` is the structural guard for the *distribution* side. It asserts:

- **No scoring module** (`confidence.py`, `calibrate.py`, `ledger_context.py`, `research_memory.py`, `score_report.py`, `scaffold_payload.py`) references any marketing metric — the banned terms are `social_engagement`, `engagement`, `impressions`, `clicks`, `report_views`, `download_log` (matched as whole words, case-insensitive).
- **`web/lib/engagement.ts`** (the web engagement recorder) never imports the scoring path (`confidence`, `calibrate`, `ledger_context`, `ledger`, `research_memory`, `score_report`, `scaffold_payload`, `taxonomy`) — only its `import`/`require` lines are inspected, so the firewall doc-comment itself doesn't trip it.

If clean it prints `FIREWALL OK` and exits 0; any violation is listed and exits 1. The rationale, from the test's own header: *engagement (impressions / clicks / likes) is a popularity signal; if it ever fed back into confidence, bias, or outcome scoring, the system would start optimising for what spreads instead of what's correct.* This test makes that regression a build failure. See also [../architecture/trust-boundaries.md](../architecture/trust-boundaries.md).

## Where social sits in the pipeline

```
intraday.py ─┐
research_pack.py ─┤
social_pack.py (OPTIONAL, subtract-only) ─┼─► ledger_context.py ─► AI brief
                                          │                          │
                                          ▼                          ▼
                                 confidence.social_adjustment() ◄── scaffold_payload.py
                                          (penalty -10..0)            │
                                                                      ▼
                                                              mvp_report.py ─► publish.py
                                                                                    │
                                                  (downstream, marketing only) ─────┘
                                                                                    ▼
                                                                            social_posts.py
                                                                            (drafts only, NO posting)
```

## Optionality in practice

Skip `social_pack.py` entirely and nothing breaks: `scaffold_payload.py` loads `data/social/<NAME>_social_pack.json` if present, otherwise passes `None`, and `confidence.social_adjustment(None)` returns a 0 adjustment with `{"reason": "no social data"}`. The social pack is for *awareness* — crowding/hype/contrarian risk, catalyst discovery, retail-attention shifts — never for facts or for generating confidence.

## Related tests

- `scripts/test_firewall.py` — the marketing/scoring firewall (both directions).
- `scripts/test_social_posts.py` — the distribution safe-wording gate, the negated-"guaranteed" allowance, and the neutral "AssetFrame published…" framing.
- `scripts/test_confidence.py` — asserts social is subtract-only (never raises) and that absent social yields a 0 adjustment.

`NOT VERIFIED` — there is **no `scripts/test_social_pack.py`**. The pack's validation (platform/sentiment/risk enums, the `aggregate` shape consumed by confidence) is exercised only indirectly via `test_confidence.py`'s social-adjustment tests. To check: add a `test_social_pack.py` covering the enum validators and the subtract-only `aggregate` contract.

## Related docs

- [social-intelligence.md](social-intelligence.md) — `social_pack.py` in full.
- [distribution.md](distribution.md) — `social_posts.py` in full.
- [../confidence/components.md](../confidence/components.md) — the social adjustment inside the confidence blend.
- [../architecture/trust-boundaries.md](../architecture/trust-boundaries.md) — the firewall and subtract-only boundaries.
