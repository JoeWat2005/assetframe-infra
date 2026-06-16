# Claims and the `THESIS_BLOCKED` gate

A *claim* is a factual statement in the analyst's brief (`data/briefs/<NAME>_research_brief.json`) that may inform the thesis. Claims are the unit the no-invention policy operates on. This doc traces a claim from the brief through every gate that can reject or downgrade it.

## The claim object (in the brief)

Each entry in the brief's `claims[]` is (from `.claude/skills/mvp/SKILL.md` and `scaffold_payload._claims()`):

```
{ "claim": "...", "status": "<status>", "source": "...", "used_in_thesis": true|false }
```

- `claim` — the factual statement, in words.
- `status` — the sourcing strength (vocabulary below).
- `source` — the source URL or named source. Used by `confidence._claim_traced()` to match the claim back to a research-pack item.
- `used_in_thesis` — whether this claim is load-bearing for the directional call.

These claims surface in the Pro report's **Source audit** and feed `meta.high_impact_claims` in the payload.

## The claim status vocabulary

The valid statuses (enforced identically in `scaffold_payload._claims()` `valid` set and `mvp_report.CLAIM_STATUSES`):

| Status | Meaning | May drive a thesis? |
|---|---|---|
| `confirmed` | Officially confirmed / first-party | Yes |
| `multiple-source` | Corroborated across independent sources | Yes |
| `single-source` | One source only | Support only — never central |
| `unverified` | Reported but not stood up | **No** (`THESIS_BLOCKED`) |
| `stale` | Was true, now out of date | **No** (`THESIS_BLOCKED`) |
| `unavailable` | Data could not be sourced | **No** (`THESIS_BLOCKED`) |

`THESIS_BLOCKED = {"unverified", "stale", "unavailable"}` is defined in `mvp_report.py` and mirrored by the `{unverified, stale, unavailable}` check in `scaffold_payload._claims()`.

The SKILL's editorial guidance: never overstate — write *"multiple-source reports of a draft agreement; signature unconfirmed"*, not *"confirmed draft"*. High-impact claim categories that must always be labelled with a status include IPO/debut, market-cap, index inclusion/exclusion, central-bank probabilities, geopolitical deals, official inventories, earnings dates, ratings news, CFTC positioning, exchange-schedule changes, roll assumptions, options/gamma, and ETF flows.

## The three gates, in order

### 1. Research pack — items must be sourced + timestamped (`research_pack.py`)

Before the brief is even written, the *research pack* (`data/research/<NAME>_research_pack.json`) enforces: any **item** marked `used_in_thesis: true` must carry a non-empty source **and** a `timestamp`, else `die()` → exit 2. This is the first line — the analyst can't register a thesis-driving fact without sourcing it. See [news-context.md](news-context.md).

### 2. Scaffold — claim status gate (`scaffold_payload._claims()`)

When the brief is compiled, `_claims()`:
- rejects any claim whose `status` is not in the valid set (`die()` → exit 2);
- rejects any `used_in_thesis` claim whose status is in `{unverified, stale, unavailable}` with the message *"is {status} but used_in_thesis - cannot drive thesis"* (exit 2).

`scaffold_payload.py --check` runs this validation and prints the would-be confidence **without writing** — so the analyst fixes the brief, then runs for real. See [../report-engine/scaffold_payload.md](../report-engine/scaffold_payload.md).

### 3. Render — `THESIS_BLOCKED` re-check (`mvp_report.run_qa()`)

At render time, `run_qa()` re-validates `meta.high_impact_claims`:
- a claim with a status not in `CLAIM_STATUSES` is an error;
- a claim that is `used_in_thesis` **and** has a `THESIS_BLOCKED` status is an error.

Any error aborts the build with *"BUILD ABORTED - no artifacts written"* (exit 1). This is a regression guard: the scaffold already rejected such claims, but the QA gate re-checks so a hand-edited payload can't slip one through.

## Confidence impact (not just pass/fail)

Beyond the binary gate, claim sourcing **scales the catalyst confidence component** (`confidence.catalyst_confidence()`):

- claim-status scores: `multiple-source`/`confirmed`/`official` → 1.0, `single-source` → 0.5, `unverified` → 0.25, `stale` → 0.3, `unavailable` → 0.2;
- when a research pack is present, a `used_in_thesis` claim with a **weak** status (`single-source`/`unverified`/`stale`) that is **not traceable** to a pack item is downgraded to ≤ 0.25 (`_claim_traced()` matches `claim.source` against each pack item's `url`/`source`);
- a strong claim (`multiple-source`/`confirmed`/`official`) is **never** penalised for a fuzzy string mismatch — otherwise adding the pack would paradoxically lower confidence;
- a single-source/unverified high-impact **thesis** also triggers a **hard cap of 55** on published confidence (`_has_unsupported_thesis()` → `single_source_thesis->55`).

See [../confidence/components.md](../confidence/components.md) and [../confidence/limitations.md](../confidence/limitations.md).

## Traceability: how a claim links to a source

`research_pack.validate()` mirrors each item's `source_url` into a `url` field *specifically* so `confidence._claim_traced()` (which reads `item['url']` / `item['source']`) can match a brief claim back to the pack. The match is a case-insensitive substring test in either direction (`s in cs or cs in s`). This is deliberately lenient on the *string* but strict on the *status*: the status gate is the hard wall; traceability only adjusts the confidence weight of an already-status-valid claim.

## Edge cases

- **A clean technical call with no claims** — allowed. `catalyst_confidence()` returns a neutral 0.5 when there are no claims; absence of news is not penalised.
- **A claim used as context but not thesis** (`used_in_thesis: false`) — any status is allowed; it appears in the report's source audit but cannot move the thesis or trigger the cap.
- **Hand-edited payload** — the render-time `THESIS_BLOCKED` re-check catches a blocked thesis claim even if the scaffold was bypassed.

## Related tests

- `scripts/test_scaffold_payload.py` — covers the `THESIS_BLOCKED` claim-sourcing gate at the scaffold layer (verified: the test's docstring names the gate).
- `scripts/test_confidence.py` — covers the catalyst component's claim-status scoring and division guards.

`NOT VERIFIED` — no test asserts the *render-time* `mvp_report.run_qa()` `THESIS_BLOCKED` branch directly (there is no `test_mvp_report.py`). To check: add a payload-level test that sets a `used_in_thesis` high-impact claim to `unverified` and asserts exit 1 / "BUILD ABORTED".

## Related docs

- [overview.md](overview.md) · [source-policy.md](source-policy.md) · [news-context.md](news-context.md)
- [../report-engine/scaffold_payload.md](../report-engine/scaffold_payload.md) — the scaffold claim gate.
- [../report-engine/mvp-report.md](../report-engine/mvp-report.md) — the QA gate.
- [../confidence/components.md](../confidence/components.md) — the catalyst component.
