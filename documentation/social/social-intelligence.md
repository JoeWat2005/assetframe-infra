# `social_pack.py` — optional, subtract-only social intelligence

`scripts/social_pack.py` validates and structures the *market conversation* into a soft signal the confidence engine can use to **reduce** (never raise) the published score. The whole pipeline runs without it.

- **Source:** `C:\Users\cwatm\Desktop\advisor\mvp\scripts\social_pack.py`
- **Output:** `data/social/<NAME>_social_pack.json` (gitignored)
- **Consumed by:** `confidence.social_adjustment()` — which reads only the `aggregate` block (see [../confidence/components.md](../confidence/components.md)).

## The two hard rules

1. **Optional.** `scaffold_payload.py` passes `social=None` when the pack is absent, and `confidence.social_adjustment(None)` returns `0.0`. *"Skip this script entirely and nothing breaks."*
2. **Subtract-only.** Social may only *reduce* confidence, never raise it; it is never a factual claim, never a thesis driver, never confidence generation. Always labelled "market conversation", never fact.

As with the research pack, **Python does not call the web**: the AI gathers chatter (via the `last30days` skill — Reddit/HN/Polymarket keyless — and WebSearch) and hands a draft JSON; `social_pack.py` normalises and structures it. It *flags* low-quality/unsourced sources but **never asserts facts** — it only structures sentiment so confidence can apply a subtract-only penalty.

## CLI

```
python scripts/social_pack.py <NAME> [--in <draft.json>] \
       [--out data/social/<NAME>_social_pack.json] [--print]
```

- With **no `--in`**, emits a **template skeleton** (`emitted = "template"`).
- With `--in <draft>`, validates and writes the clean pack (`emitted = "validated"`).
- `--print` echoes the result.
- **Exit codes:** `0` ok · `2` validation error (bad platform / sentiment / signal_quality / risk value).

## Schema

```jsonc
{
  "instrument": "...",
  "generated_at_utc": "... UTC",
  "sources": [
    {
      "platform": "X|Reddit|Stocktwits|YouTube|news_comments|other",
      "url": "...", "timestamp": "... UTC", "summary": "...",
      "sentiment": "bullish|bearish|mixed|neutral",
      "themes": ["..."],
      "signal_quality": "high|medium|low",
      "notes": "..."
    }
  ],
  "aggregate": {
    "sentiment": "bullish|bearish|mixed|neutral",
    "dominant_themes": ["..."],
    "crowding_risk": "low|medium|high|unknown",
    "hype_risk": "low|medium|high|unknown",
    "contrarian_warning": "",
    "source_gaps": ["..."]
  }
}
```

Validated enums (each a `die()`/exit-2 on a bad value):

- `PLATFORMS = ("X", "Reddit", "Stocktwits", "YouTube", "news_comments", "other")` — case-insensitive (`_PLATFORM_CANON` maps `reddit` → `Reddit`, etc.).
- `SENTIMENT = ("bullish", "bearish", "mixed", "neutral")`.
- `SIGNAL_QUALITY = ("high", "medium", "low")`.
- `RISK = ("low", "medium", "high", "unknown")` (used for `crowding_risk` and `hype_risk`).

The validated output adds a `note` ("Supplementary, non-authoritative sentiment. Confidence impact is subtract-only.") and a `counts` block.

## The `aggregate` block is the only thing confidence reads

`confidence.social_adjustment()` consumes **exactly** three fields of `aggregate`, and applies a subtract-only penalty clamped to `max(-10.0, pen)`:

| Field | Value | Penalty |
|---|---|---|
| `hype_risk` | `high` | −5 |
| `hype_risk` | `medium` | −2 |
| `crowding_risk` | `high` | −3 |
| `crowding_risk` | `medium` | −1 |
| `contrarian_warning` | truthy (non-empty) | −2 |

No social data → `0.0`. There is **no positive branch** — the function can only return ≤ 0. This is the mechanical guarantee that social can never raise confidence. See [../confidence/components.md](../confidence/components.md) for how the adjustment enters the blend (`raw = 50·market + 30·ledger + 20·catalyst + social_adj`).

## Interaction with the hard caps

A *hype-driven thesis* triggers a **hard cap of 55** on published confidence — but only when **both** conditions hold (`confidence._hype_thesis()`): the social pack's `aggregate.hype_risk == "high"` **and** the brief's `social_context.drives_thesis` is truthy. So the cap fires when the analyst has actually leaned on hyped chatter, not merely when hype exists in the market. See [../confidence/limitations.md](../confidence/limitations.md).

## Flagging, not asserting

`validate()` records two kinds of `source_gaps` rather than rejecting sources:

- an **unsourced** source (no `url`) → `"unsourced social (<platform>): <summary>"`;
- a **low-signal** source (`signal_quality == "low"`) → `"low-signal source (<platform>): <summary>"`.

These gaps are awareness for the analyst; they do not assert anything factual.

## How the analyst uses it

1. (Optional) gather chatter with `last30days`/WebSearch.
2. Run `social_pack.py <NAME>` with no `--in` for the template, fill it, then `--in <draft>` to validate.
3. Use it for sentiment awareness, crowding/hype/contrarian risk, and catalyst *discovery* — never for facts. Label it "market conversation" in the brief (the render-time QA warns otherwise).
4. If you skip it, the pipeline proceeds with a 0 social adjustment.

## Edge cases

- **No `sources`** — allowed; `aggregate` defaults are valid (`sentiment: neutral`, risks `unknown`).
- **Draft not found / invalid JSON** — `die()` → exit 2.
- **`hype_risk`/`crowding_risk` = `unknown`** — no penalty (only `high`/`medium` subtract).

## Related tests

- `scripts/test_confidence.py` — asserts the social adjustment is subtract-only (never raises) and that absent social → 0.
- `scripts/test_firewall.py` — proves marketing metrics never reach the scoring path.

`NOT VERIFIED` — no dedicated `scripts/test_social_pack.py` for the enum validators / `aggregate` contract. To check: add one that feeds bad `platform`/`sentiment`/`risk` values and asserts exit 2, and asserts an unsourced source lands in `source_gaps`.

## Related docs

- [overview.md](overview.md) · [distribution.md](distribution.md)
- [../confidence/components.md](../confidence/components.md) — the social adjustment in the blend.
- [../confidence/limitations.md](../confidence/limitations.md) — the hype-driven-thesis cap.
- [../research/news-context.md](../research/news-context.md) — the parallel (factual, gated) research pack.
