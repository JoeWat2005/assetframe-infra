"""Bridge: Python report pipeline -> the Next.js app.

Writes the catalog + track-record as JSON the web app reads. Report files are NOT copied
into the web app: every file (free Snapshots AND Pro reports) is private in R2 (pushed by
scripts/publish.py) and served only through the auth-gated /api/report route.

Usage:
  python scripts/export_content.py [--web web] [--include-dev]

Outputs:
  web/content/catalog.json        list of editions (metadata + /api/report asset paths)
  web/content/track-record.json   { stats, open[], scored[], calibration }
"""
import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_catalog(reports_dir, include_dev):
    editions = []
    for meta_path in sorted(reports_dir.glob("*/*/metadata.json")):
        date, slug = meta_path.parent.parent.name, meta_path.parent.name
        if not include_dev and date.startswith("_"):
            continue
        try:
            m = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        d = meta_path.parent
        base = f"/api/report/{date}/{slug}"
        editions.append({
            "date": date, "slug": slug,
            "instrument": m.get("instrument", slug),
            "ticker": m.get("ticker", ""),
            "assetClass": m.get("asset_class", ""),
            "status": m.get("status", ""),
            "risk": m.get("risk_rating", ""),
            "bias": m.get("primary_bias") or m.get("research_view", ""),
            "lastPrice": m.get("last_price", ""),
            "dataQuality": m.get("data_quality_score", ""),
            "windowEnd": m.get("prediction_window_end_report_tz", ""),
            "reportDate": m.get("report_date", date),
            "catalystStatus": m.get("catalyst_status", ""),
            "freeHtml": f"{base}/free.html",
            "freePdf": f"{base}/free.pdf",
            "preview": f"{base}/preview.png",
            "hasPro": (d / "pro.html").exists(),
            "_dir": d,
        })
    editions.sort(key=lambda e: (e["date"], e["slug"]), reverse=True)
    return editions


def load_track_record(ledger_csv, pred_dir, scored_ids):
    scored, calib = [], None
    hits_by_id = {}
    if ledger_csv.exists() and ledger_csv.stat().st_size > 0:
        rows = list(csv.DictReader(ledger_csv.open(encoding="utf-8")))
        for r in rows:
            rid = r.get("report_id", "")
            if rid:
                hits_by_id[rid] = int(r.get("hits", 0) or 0)
            scored.append({
                "reportId": r.get("report_id", ""),
                "instrument": r.get("instrument", ""), "view": r.get("view", ""),
                "confidence": r.get("confidence", ""), "results": r.get("results", ""),
                "hits": r.get("hits", ""), "misses": r.get("misses", ""),
                "hitRate": r.get("hit_rate_pct", ""), "windowEnd": r.get("window_end_utc", ""),
            })
        if len(rows) >= 10:
            buckets = {"<=60": [], "61-75": [], ">75": []}
            for r in rows:
                try:
                    c, hr = float(r["confidence"]), float(r["hit_rate_pct"])
                except (ValueError, KeyError):
                    continue
                buckets["<=60" if c <= 60 else ("61-75" if c <= 75 else ">75")].append(hr)
            calib = {k: {"hitRate": round(sum(v) / len(v), 1) if v else None, "n": len(v)}
                     for k, v in buckets.items()}

    open_calls = []
    for pf in sorted(pred_dir.glob("*_predictions.json")):
        try:
            p = json.loads(pf.read_text(encoding="utf-8"))
        except Exception:
            continue
        # Keep scored reports in the list too — their tracker flips from 0/n to hits/n.
        preds = p.get("predictions", [])
        sub = [{
            "id": x.get("id", ""),
            "type": x.get("type", ""),
            "text": x.get("text") or x.get("note") or "",
            "manual": x.get("type") == "manual",
            # Force bool-or-null so this matches sync-db's coercion (DB == JSON fallback).
            "expect": x.get("expect") if isinstance(x.get("expect"), bool) else None,
        } for x in preds]
        rid = p.get("report_id", pf.stem)
        open_calls.append({
            "reportId": rid, "instrument": p.get("instrument", ""),
            "symbol": p.get("symbol", ""), "view": p.get("view", ""),
            "confidence": p.get("confidence", ""), "windowEnd": p.get("window_end_utc", ""),
            "n": len(preds), "nManual": sum(1 for x in preds if x.get("type") == "manual"),
            "hits": hits_by_id.get(rid, 0), "scored": rid in scored_ids,
            "predictions": sub,
        })
    open_calls.sort(key=lambda c: c["windowEnd"])
    return scored, open_calls, calib


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", default="web")
    ap.add_argument("--reports", default="reports")
    ap.add_argument("--include-dev", action="store_true")
    a = ap.parse_args()

    web = (ROOT / a.web) if not Path(a.web).is_absolute() else Path(a.web)
    reports_dir = (ROOT / a.reports) if not Path(a.reports).is_absolute() else Path(a.reports)
    content = web / "content"
    content.mkdir(parents=True, exist_ok=True)

    catalog = load_catalog(reports_dir, a.include_dev)

    # ledger stats from the raw CSV (hits/misses) for the headline numbers
    ledger_csv = ROOT / "ledger" / "outcome_ledger.csv"
    scored_ids = set()
    hits = misses = total = 0
    if ledger_csv.exists() and ledger_csv.stat().st_size > 0:
        for r in csv.DictReader(ledger_csv.open(encoding="utf-8")):
            total += 1
            scored_ids.add(r.get("report_id"))
            hits += int(r.get("hits", 0) or 0)
            misses += int(r.get("misses", 0) or 0)

    scored, open_calls, calib = load_track_record(ledger_csv, ROOT / "data" / "predictions", scored_ids)
    graded = hits + misses
    track = {
        "stats": {
            "reportsScored": total, "openCalls": len(open_calls),
            "predictionsGraded": graded,
            "hitRate": round(100 * hits / graded, 1) if graded else None,
        },
        "open": open_calls, "scored": scored, "calibration": calib,
    }

    # Report files live in private R2 (run scripts/publish.py), not in the web app.
    for e in catalog:
        del e["_dir"]

    (content / "catalog.json").write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    (content / "track-record.json").write_text(json.dumps(track, indent=2), encoding="utf-8")

    print(f"Exported -> {content}")
    print(f"  editions:    {len(catalog)}")
    print(f"  open calls:  {len(open_calls)}")
    print(f"  scored rows: {total}" + ("  (calibration ready)" if calib else ""))
    print("All report files (free + Pro) are private in R2 - run scripts/publish.py to push them.")


if __name__ == "__main__":
    main()
