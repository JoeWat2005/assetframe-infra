# The outcome ledger — AssetFrame's spine

> *"Next-session market intelligence, scored after the fact."*

The ledger is the part of AssetFrame that makes the brand promise mechanical rather
than editorial. Every Pro edition registers falsifiable, machine-checkable
predictions for the *next* session; after each window closes, those predictions are
graded against the actual tape and the result is appended — never edited — to one
file. The public track record, the per-confidence calibration curve, the
ledger-as-input feedback into the next brief, and the deterministic confidence
score all flow from that one file.

In the V2 engine the role split is summarised as:

> **AI = analyst / strategist. Python = compiler / validator. Ledger = memory +
> calibration + proof. Confidence = deterministic + auditable.**

This document is the index for the `ledger` documentation vault. It states what the
ledger is, where it lives, the two roles it plays (record *and* input), how it
reaches the website, and the current day-one state. The deep mechanics live in the
sibling docs cross-linked below.

---

## 1. What it is

A single append-only CSV, **one row per scored report**:

- **File:** `ledger/outcome_ledger.csv` (relative to the `mvp/` project root)
- **Owner / writer:** `scripts/score_report.py` (the only writer)
- **Schema:** `LEDGER_COLS` in `scripts/score_report.py` — 20 columns, the first 13
  the original schema (never reordered), the trailing 7 additive V2
  taxonomy/confidence columns. See `outcome-scoring.md` for the column-by-column
  meaning.
- **Integrity model:** append-only; rows are never edited or reordered; an
  incomplete window is never scored. See `append-only-design.md`.

### Current state — day one, empty ledger

At the time of writing the ledger **does not yet exist on disk**. `score_report.py`
creates the file and writes the header row on the first append (its `new_file`
check, see `append-only-design.md`). The two sibling artefacts in `ledger/` are
present and both encode the empty state:

- `ledger/calibration_map.json` — an **identity** map (`n_rows: 0`, `method:
  "identity"`, knots `[[0,0],[100,100]]`), see `calibration.md`.
- `ledger/research_memory.json` — the **"no memory yet"** object
  (`total_scored_reports: 0`, all breakdowns `{}`, a single explanatory note), see
  below and `outcome-scoring.md`.
- `ledger/.gitkeep` — keeps the otherwise-empty directory in git.

Meanwhile `data/predictions/` already holds many registered prediction files
(AAPL, BTC, ES, GOLD, WTI, …) **awaiting** scoring — these are the open calls that
will produce the first ledger rows once their windows close and step 1 of the
`/mvp` flow scores them. Every component below is written to degrade gracefully to
this empty state, so the pipeline runs correctly on day one.

> When documenting numbers, never imply a populated ledger. The honest current
> answer to "what is the hit rate?" is *no scored history yet*.

---

## 2. The two roles

The ledger is read in two opposite directions, and keeping them straight is the
whole design.

### Role A — the record (write side)

`scripts/score_report.py` resolves a report's predictions after its window closes
and **appends** one row. It writes the packed `results` string, `hits`/`misses`/
`hit_rate_pct`, the setup outcome, the partial flag, and the taxonomy/confidence
columns. It never rewrites history. Doing this **first in each `/mvp` run** —
before any new report is generated — is what guarantees the record can't be
back-fitted (see `append-only-design.md`). Detail: `outcome-scoring.md`.

### Role B — the input (read side, NO look-ahead)

Two pure-derivation scripts turn the same ledger back into a research *input*,
consumed before the AI writes its brief and by the confidence engine:

- **`scripts/ledger_context.py`** — per-instrument view. Writes
  `data/ledger_context/<NAME>_ledger_context.json`: instrument / asset-class /
  overall hit rates, prediction-type breakdowns, recent streak and drift,
  similar-setup history, named success/failure patterns, and `notes_for_ai[]`.
  Feeds the AI brief **and** `confidence.ledger_confidence`.
- **`scripts/research_memory.py`** — cross-instrument view (PURE derivation, no AI
  input). Writes `ledger/research_memory.json`: breakdowns by prediction type,
  market regime, asset class, direction, and the prediction-type×regime *learning
  cross*, plus best/worst patterns. Demonstrates *learning* ("breakout in
  high-volatility regimes: 71%"), not just accuracy.

Both enforce the **hard no-look-ahead rule**: their `load_rows` aggregates only
rows whose `window_end_utc` is **strictly before** `--as-of` (default: now). So
nothing a report could not have known at generation time can leak into its own
inputs. Both degrade to a valid neutral "no history yet" object on an empty/young
ledger. Detail: `outcome-scoring.md` (the read-side aggregation) and the
no-look-ahead notes in `append-only-design.md`.

### Why scoring-first closes the loop

```
   (run N, step 1)            (run N, steps 2..12)
   score_report.py    ─►   ledger_context.py / research_memory.py   ─►  AI brief
   appends row(s)          read ONLY windows closed before now          + confidence
   for windows that                                                     for run N's
   closed since run N-1                                                  new report
```

Because the only rows that exist are for windows that already closed, and the read
side additionally filters on `window_end_utc < as_of`, the feedback loop is
provably free of look-ahead even if a row were mis-stamped.

---

## 3. How it surfaces (ledger → web)

The raw CSV is **not** what the web app serves. `scripts/export_content.py` reads
`ledger/outcome_ledger.csv` and builds `web/content/track-record.json` — headline
stats, open calls, scored rows (with per-call verdicts parsed from the packed
`results`), the 3-bucket calibration, and derived analytics arrays (by instrument /
asset class / prediction type / regime, a cumulative timeline, a 10-point
calibration curve, and confidence-band vs realised outcome). That JSON (loaded into
Neon, with a JSON fallback) is what the website and the MCP server expose. Detail:
`track-record-export.md`.

On `/track-record` the split is: signed-out and free visitors get the **public
accuracy headline**; the full open-calls list, scored results and analytics are
**Pro-only** (README §7).

```
score_report.py ─► ledger/outcome_ledger.csv ─► export_content.py ─► web/content/track-record.json ─► /track-record + /api/mcp + /api/v1
```

---

## 4. Ledger documentation index

| Doc | Covers |
|---|---|
| `overview.md` (this file) | What the ledger is, where it lives, the two roles, how it surfaces, the day-one state. |
| `append-only-design.md` | The integrity model: append-only, never edit/reorder, never score an incomplete window, scoring-first = no look-ahead, the additive-columns evolution, how `score_report.py` enforces it, the audit angle. |
| `outcome-scoring.md` | The ledger ROW in full — every one of the 20 columns and how `score_report.py` fills it, the packed `results` format, hits/misses/hit-rate, partial, taxonomy/confidence columns, and the per-run 3-bucket `calibration()` summary. |
| `track-record-export.md` | `export_content.py`'s `track-record.json`: the full shape, every analytics array, the ≥10-row gates, open-vs-scored, per-call verdicts, and the free/Pro split. |
| `calibration.md` | `calibrate.py` at the ledger level — how it fits the map (`conf_raw`, PAVA isotonic + shrinkage-to-identity), `conf_version` filtering, the identity guarantees, and the three calibration concepts that must not be confused. |

### Related vaults

- **`../predictions/`** — the prediction *intent*, schema, taxonomy, and the
  per-mechanic scoring detail. The ledger *records* what predictions resolve to;
  the grading mechanics (how `close_above`, `range_inside`, `no_close_above_after_touch`,
  the setup grader, etc. produce Y / N / NT) are owned by **`../predictions/scoring.md`**
  (cross-linked from `outcome-scoring.md`). `../predictions/overview.md` is present.
- **`../confidence/`** — the confidence math and the *application* of the
  calibration map inside `confidence.py`. `calibration.md` here owns the *fitting*
  side; **`../confidence/calibration.md`** owns the application side. (The
  `../confidence/` vault is currently empty — mark cross-links `NOT VERIFIED`
  until those files exist.)

---

## 5. Related tests

- `scripts/test_score_report.py` — scoring mechanics, the setup grader, the
  `calibration()` summary, the manual-verdict validator, and the **append-only**
  ledger write (`test_two_scores_append_not_rewrite`, `test_dry_run_writes_nothing`).
- `scripts/test_ledger_context.py` — covers **both** `ledger_context.py` and
  `research_memory.py`: the no-look-ahead filter, empty-ledger degradation, and the
  taxonomy-scoped breakdowns.
- `scripts/test_calibrate.py` — PAVA monotonicity, shrinkage-to-identity, the
  empty/young-ledger identity guarantee.

Run any of them with `python scripts/<name>.py`.

---

## Security & integrity note

The ledger is the system's audit trail. Its trustworthiness rests on three
properties enforced in code, not policy: (1) append-only, never edited or reordered;
(2) windows scored only after they close, with `--force` the sole, explicit escape
hatch for a deliberate PARTIAL; (3) the read side filters strictly on
`window_end_utc` so history cannot leak forward. See `append-only-design.md` for how
each is enforced.
