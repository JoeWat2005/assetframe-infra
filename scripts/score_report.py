"""Outcome scorer — resolves a report's falsifiable predictions and appends to the ledger.

Usage:
  python scripts/score_report.py <predictions.json> [--hourly <csv>] [--force]
         [--manual ID=V[,ID=V...]] [--dry-run]

  --manual P5=Y[,P6=NT]  resolve `type:"manual"` predictions (verdicts: Y, N, NT).
                         Repeatable. Every id must exist in the file and be manual-type,
                         else exit 2 BEFORE any ledger write. Unresolved manuals stay
                         MANUAL and are excluded from the hit rate.
  --dry-run              compute and print everything, write nothing to the ledger.
  --force                score an open window (PARTIAL), or accept an hourly CSV that
                         stops >75 min short of the window end (early close / holiday).

predictions.json schema (registered in data/predictions/ at report time):
{
  "report_id": "ADV-20260612-GBPJPY",
  "instrument": "GBP/JPY", "symbol": "GBPJPY=X", "roll_utc": 22,
  "view": "Constructive", "confidence": 64,
  "window_start_utc": "2026-06-11 23:00", "window_end_utc": "2026-06-12 21:00",
  "hourly_csv": "data/candles/GBPJPY_hourly.csv",
  "predictions": [
    {"id": "P1", "type": "close_above", "level": 214.79, "expect": true},
    {"id": "P2", "type": "range_inside", "lo": 213.59, "hi": 215.98, "expect": true},
    {"id": "P3", "type": "no_close_above_after_touch", "touch": 214.94, "level": 215.05, "expect": true},
    {"id": "P4", "type": "no_close_below", "level": 213.90, "expect": true},
    {"id": "P5", "type": "manual", "note": "GDP <= -0.3% then <= 214.19 within 2h"}
  ],
  "setup": {"direction": "long", "entry_lo": 214.44, "entry_hi": 214.55,
            "invalidation": 214.10, "t1": 214.94}
}

Verdicts per prediction: Y (came true), N (did not), NT (condition never triggered),
MANUAL (needs human input). Hit rate counts Y / (Y + N).
Ledger: ledger/outcome_ledger.csv  (append-only, one row per scored report)

Exit codes: 0 scored or window-still-open · 2 argument/validation error ·
3 hourly CSV does not cover the window (refresh via scripts/intraday.py, then retry).

Once the ledger holds >=10 reports the summary gains a `calibration` block: realized
hit rate by stated-confidence bucket (<=60 / 61-75 / >75) — stated confidence should
track realized hit rate; if it doesn't, the confidence rubric needs recalibrating.
"""
import csv, json, sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from taxonomy import confidence_bucket
except Exception:                       # standalone fallback
    def confidence_bucket(score):
        try:
            c = float(score)
        except (TypeError, ValueError):
            return None
        return "<=60" if c <= 60 else ("61-75" if c <= 75 else ">75")

LEDGER = Path("ledger/outcome_ledger.csv")
# The first 13 columns are the original schema (never reordered - append-only).
# The trailing columns (Confidence V2 + prediction taxonomy) are additive; older
# rows simply lack them and read back as "" via DictReader.
LEDGER_COLS = ["scored_at_utc", "report_id", "instrument", "view", "confidence",
               "window_end_utc", "results", "hits", "misses", "hit_rate_pct",
               "setup_filled", "setup_outcome", "partial",
               "conf_version", "conf_raw", "asset_class", "pred_type",
               "direction", "horizon", "market_regime"]
TAIL_TOLERANCE_MIN = 75  # one hourly bar (stamped at bar-open) + slack
VALID_MANUAL = {"Y", "N", "NT"}


def parse_dt(s):
    return datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)


def load_bars(path, start, end):
    bars = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.reader(f):
            if len(r) >= 5 and r[0][:2].isdigit():
                t = parse_dt(r[0][:16])
                if start <= t <= end:
                    bars.append({"t": t, "o": float(r[1]), "h": float(r[2]),
                                 "l": float(r[3]), "c": float(r[4])})
    return bars


def parse_args(argv):
    opts = {"force": False, "dry_run": False, "hourly": None, "manual": {}}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--force":
            opts["force"] = True
        elif a == "--dry-run":
            opts["dry_run"] = True
        elif a == "--hourly":
            i += 1
            if i >= len(argv):
                print("ERROR: --hourly needs a path")
                sys.exit(2)
            opts["hourly"] = argv[i]
        elif a == "--manual":
            i += 1
            if i >= len(argv):
                print("ERROR: --manual needs ID=V[,ID=V] with V in Y|N|NT")
                sys.exit(2)
            for pair in argv[i].split(","):
                k, sep, v = pair.partition("=")
                k, v = k.strip(), v.strip().upper()
                if not sep or not k or v not in VALID_MANUAL:
                    print(f"ERROR: bad --manual entry '{pair}' (want ID=Y|N|NT)")
                    sys.exit(2)
                opts["manual"][k] = v
        else:
            print(f"ERROR: unknown argument {a}")
            sys.exit(2)
        i += 1
    return opts


def validate_manual(overrides, predictions):
    """A typo must never freeze a wrong verdict into the append-only ledger."""
    manual_ids = {q["id"] for q in predictions if q.get("type") == "manual"}
    for k in overrides:
        if k not in manual_ids:
            print(f"ERROR: --manual {k} does not match a manual prediction "
                  f"(manual ids here: {', '.join(sorted(manual_ids)) or 'none'})")
            sys.exit(2)


def score_prediction(p, bars):
    typ = p.get("type")
    if typ == "manual":
        return "MANUAL"
    if not bars:
        return "NT"
    if typ == "close_above":
        return "Y" if bars[-1]["c"] > p["level"] else "N"
    if typ == "close_below":
        return "Y" if bars[-1]["c"] < p["level"] else "N"
    if typ == "range_inside":
        ok = min(b["l"] for b in bars) >= p["lo"] and max(b["h"] for b in bars) <= p["hi"]
        return "Y" if ok else "N"
    if typ == "touches":
        return "Y" if any(b["l"] <= p["level"] <= b["h"] for b in bars) else "N"
    if typ == "no_close_below":
        return "Y" if all(b["c"] >= p["level"] for b in bars) else "N"
    if typ == "no_close_above":
        return "Y" if all(b["c"] <= p["level"] for b in bars) else "N"
    if typ == "no_close_above_after_touch":
        touched = [i for i, b in enumerate(bars) if b["h"] >= p["touch"]]
        if not touched:
            return "NT"
        i = touched[0]
        return "N" if bars[i]["c"] > p["level"] else "Y"
    if typ == "no_close_below_after_touch":
        touched = [i for i, b in enumerate(bars) if b["l"] <= p["touch"]]
        if not touched:
            return "NT"
        i = touched[0]
        return "N" if bars[i]["c"] < p["level"] else "Y"
    return f"UNKNOWN({typ})"


def score_setup(s, bars):
    """Did the entry zone fill, and did T1 or the Invalidation Level come first?"""
    if not s or not bars:
        return "no", "n/a"
    long_side = s.get("direction", "long") == "long"
    fill_i = None
    for i, b in enumerate(bars):
        hit = (b["l"] <= s["entry_hi"]) if long_side else (b["h"] >= s["entry_lo"])
        if hit:
            fill_i = i
            break
    if fill_i is None:
        return "no", "n/a"
    for b in bars[fill_i:]:
        if long_side:
            if b["l"] <= s["invalidation"]:
                return "yes", "invalidation-first"
            if b["h"] >= s["t1"]:
                return "yes", "t1-first"
        else:
            if b["h"] >= s["invalidation"]:
                return "yes", "invalidation-first"
            if b["l"] <= s["t1"]:
                return "yes", "t1-first"
    return "yes", "open-at-window-end"


def calibration(rows):
    """Realized hit rate by stated-confidence bucket; None until >=10 reports."""
    if len(rows) < 10:
        return None
    buckets = {"<=60": [0, 0, 0], "61-75": [0, 0, 0], ">75": [0, 0, 0]}  # reports, hits, misses
    for r in rows:
        key = confidence_bucket(r.get("confidence"))  # shared with taxonomy.py + web/lib/content.ts
        if key is None:
            continue
        b = buckets[key]
        b[0] += 1
        b[1] += int(r["hits"] or 0)
        b[2] += int(r["misses"] or 0)
    out = {}
    for k, (n, h, m) in buckets.items():
        if n:
            out[k] = {"reports": n, "hits": h, "misses": m,
                      "hit_rate_pct": round(100 * h / (h + m), 1) if (h + m) else None}
    return {"n_reports": len(rows), "buckets": out}


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/score_report.py <predictions.json> [--hourly csv] "
              "[--force] [--manual ID=V,...] [--dry-run]")
        sys.exit(2)
    pred_path = Path(sys.argv[1])
    opts = parse_args(sys.argv[2:])
    p = json.loads(pred_path.read_text(encoding="utf-8-sig"))
    validate_manual(opts["manual"], p["predictions"])

    now = datetime.now(timezone.utc)
    wend = parse_dt(p["window_end_utc"])
    partial = False
    if now < wend:
        if not opts["force"]:
            print(f"window still open until {p['window_end_utc']} UTC - not scored "
                  f"(use --force for a partial score)")
            return
        partial = True
        wend = now
    csv_path = opts["hourly"] or p["hourly_csv"]
    bars = load_bars(csv_path, parse_dt(p["window_start_utc"]), wend)
    refresh_cmd = (f"python scripts/intraday.py {p.get('symbol', '<SYMBOL>')} "
                   f"--name {Path(csv_path).name.replace('_hourly.csv', '')}"
                   + (f" --roll-utc {p['roll_utc']}" if p.get("roll_utc") else ""))
    if not bars:
        print(f"no bars found in window - refresh the hourly CSV first:\n  {refresh_cmd}")
        sys.exit(3)
    gap_min = (wend - bars[-1]["t"]).total_seconds() / 60
    if gap_min > TAIL_TOLERANCE_MIN:
        if not opts["force"]:
            print(f"window ends {wend:%Y-%m-%d %H:%M} UTC but the hourly CSV stops at "
                  f"{bars[-1]['t']:%Y-%m-%d %H:%M} UTC ({gap_min:.0f} min short) - refresh it first:\n"
                  f"  {refresh_cmd}\n"
                  f"only if the market genuinely closed early (holiday/half-day), re-run with "
                  f"--force to score the available bars (marked PARTIAL)")
            sys.exit(3)
        partial = True

    results = {q["id"]: score_prediction(q, bars) for q in p["predictions"]}
    results.update(opts["manual"])  # validated above: manual-type ids only
    hits = sum(1 for v in results.values() if v == "Y")
    misses = sum(1 for v in results.values() if v == "N")
    rate = round(100 * hits / (hits + misses), 1) if (hits + misses) else None
    filled, outcome = score_setup(p.get("setup"), bars)
    unresolved = sorted(k for k, v in results.items() if v == "MANUAL")

    tax = p.get("taxonomy") or {}
    row = [now.strftime("%Y-%m-%d %H:%M"), p["report_id"], p["instrument"],
           p.get("view", ""), p.get("confidence", ""), p["window_end_utc"],
           " ".join(f"{k}={v}" for k, v in results.items()), hits, misses,
           rate, filled, outcome, "yes" if partial else "no",
           p.get("conf_version", ""), p.get("conf_raw", ""), tax.get("asset_class", ""),
           tax.get("prediction_type", ""), tax.get("direction", ""),
           tax.get("horizon", ""), tax.get("market_regime", "")]
    if not opts["dry_run"]:
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        new_file = not LEDGER.exists()
        with open(LEDGER, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(LEDGER_COLS)
            w.writerow(row)

    # cumulative ledger summary (dry-run: simulate this row in memory instead)
    rows = []
    if LEDGER.exists():
        with open(LEDGER, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    if opts["dry_run"]:
        rows = rows + [dict(zip(LEDGER_COLS, [str(x) for x in row]))]
        print("DRY RUN - ledger not written")
    tot_h = sum(int(r["hits"] or 0) for r in rows)
    tot_m = sum(int(r["misses"] or 0) for r in rows)
    cum = round(100 * tot_h / (tot_h + tot_m), 1) if (tot_h + tot_m) else None

    summary = {"report_id": p["report_id"], "partial": partial, "dry_run": opts["dry_run"],
               "results": results, "hit_rate_pct": rate, "unresolved_manual": unresolved,
               "setup_filled": filled, "setup_outcome": outcome,
               "ledger_reports": len(rows), "cumulative_hit_rate_pct": cum}
    cal = calibration(rows)
    if cal:
        summary["calibration"] = cal
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
