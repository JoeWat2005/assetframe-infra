# `social_posts.py` — distribution drafts (safe-worded, no auto-posting)

`scripts/social_posts.py` templates marketing copy from a **published** edition into four channel drafts. It is downstream of publishing, is firewalled from the scoring path, and — consistent with the no-auto-trading / no-auto-posting policy — **it never posts anything**.

- **Source:** `C:\Users\cwatm\Desktop\advisor\mvp\scripts\social_posts.py`
- **Input:** a compiled payload `data/payloads/<NAME>_af_payload.json` (the same artifact `scaffold_payload.py` writes) and, optionally, the brief.
- **Output:** `data/social_posts/<NAME>_<DATE>_posts.json` (gitignored).

## What it generates

Four drafts, keyed `x`, `linkedin`, `newsletter_snippet`, `reddit_summary`, built by `build_posts()` from the payload's meta (title, ticker, status, risk, confidence **band**, research view, window, report id).

Every post, by construction:

- uses **"AssetFrame published…"** framing — never "you should buy/sell…";
- expresses confidence as a **band** (`taxonomy.confidence_band`, e.g. "Elevated"), never a hard number or promise;
- carries a `{report_link}` placeholder (filled at publish time) and the line **"Scored after the session closes."**;
- ends with the disclaimer **"General market research, not personal financial advice. No outcome is guaranteed."**

The output object also records `auto_post: false` and `safe_wording_qa: "passed"`.

## The safe-wording QA gate (required)

Before anything is written, `safe_wording_check(posts)` scans every draft and **exits 2 with nothing written** on any pump/advice phrase. The `BANNED` patterns (regex, whole-word, case-insensitive):

`buy now`, `sell now`, `sure thing`, `sure trade`, `easy profit`, `risk-free`/`risk free`, `you should buy`, `you should sell`, `get rich`, `can't lose`/`cant lose`, `to the moon`.

`"guaranteed"` is permitted **only** in negated compliance form: each occurrence is checked against `GUARANTEED_OK = (no outcome is|not|never|nothing…is)\s+guaranteed` within a 40-char preceding window; an unnegated use is a build error. This mirrors the spirit of the report generator's banned-language rules (`mvp_report.BANNED` / `NEGATED_ONLY`) — see [../report-engine/mvp-report.md](../report-engine/mvp-report.md).

## No auto-posting (hard policy)

The script *only* emits drafts for a human (or a future, human-gated integration) to publish. It has no posting code path and sets `auto_post: false`. This is the same posture as the no-auto-trading rule (`README.md` §10, `mvp/CLAUDE.md`): the system is decision-support/research only and takes no autonomous external action.

## CLI

```
python scripts/social_posts.py <NAME> [--payload data/payloads/<NAME>_af_payload.json] \
       [--date YYYY-MM-DD] [--out data/social_posts/<NAME>_<DATE>_posts.json] [--print]
```

- Defaults the payload path to `data/payloads/<NAME>_af_payload.json`; `--date` defaults to the payload's `meta.report_date` (else today, UTC).
- Reads the brief at `data/briefs/<NAME>_research_brief.json` if present (tolerant: ignores invalid JSON).
- `--print` echoes the result.
- **Exit codes:** `0` ok · `2` missing payload, bad args, or **safe-wording QA failure**.

## The marketing/scoring firewall

This script is on the *marketing* side of a hard firewall. `scripts/test_firewall.py` asserts the scoring modules never read marketing metrics (`engagement`, `impressions`, `clicks`, `report_views`, `download_log`, `social_engagement`) and that the web engagement recorder (`web/lib/engagement.ts`) never imports the scoring path. The reason (from the test header): engagement is a popularity signal; letting it feed confidence/scoring would make the system optimise for what spreads rather than what's correct. `social_posts.py` reads only the *published* payload's framing fields — never engagement data — and writes only drafts. See [overview.md](overview.md) and [../architecture/trust-boundaries.md](../architecture/trust-boundaries.md).

## Edge cases

- **Payload not found** — `die()` → exit 2 ("publish/scaffold the edition first").
- **Long research view** — trimmed to 180 chars for the short channels (`view_short`).
- **Missing status/risk** — the corresponding clause is simply omitted (no broken sentences).
- **A draft that would contain banned wording** — exit 2, nothing written; rephrase to the neutral "AssetFrame published…" framing.

## Related tests

- `scripts/test_social_posts.py` — covers the safe-wording QA gate (pump/advice phrases are a build error), the negated-"guaranteed" allowance, and the neutral "AssetFrame published…" framing of generated drafts (verified: the test's docstring names exactly these).

## Status note

The SKILL's shared-infrastructure list tags `social_posts.py` as "future". The script **exists and is tested** in the repo today; what does not exist is any *posting* integration (by policy). Treat it as: drafts are generated and QA-gated now; publishing them is a manual, human-gated step.

## Related docs

- [overview.md](overview.md) · [social-intelligence.md](social-intelligence.md)
- [../report-engine/mvp-report.md](../report-engine/mvp-report.md) — the report-side banned-language / RR rules.
- [../report-engine/scaffold_payload.md](../report-engine/scaffold_payload.md) — produces the payload this script reads.
- [../architecture/trust-boundaries.md](../architecture/trust-boundaries.md) — the firewall and no-auto-posting boundaries.
