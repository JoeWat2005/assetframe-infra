# REST API examples

Base URL `{SITE.url}/api/v1` (examples use `https://www.assetframe.co.uk`). No key, no auth. Replace dates/slugs with values from the catalog.

## List reports

```bash
# Latest editions (default limit 50)
curl "https://www.assetframe.co.uk/api/v1/reports"

# Filter by asset class, cap to 5
curl "https://www.assetframe.co.uk/api/v1/reports?asset_class=crypto&limit=5"

# Filter by directional status and a single date
curl "https://www.assetframe.co.uk/api/v1/reports?status=Wait&date=2026-06-15"

# Free-text search over instrument + ticker
curl "https://www.assetframe.co.uk/api/v1/reports?q=gold"
```

Example response (truncated):
```json
{
  "total": 21,
  "returned": 5,
  "reports": [
    {
      "id": "2026-06-15/BTC",
      "date": "2026-06-15",
      "slug": "BTC",
      "instrument": "Bitcoin",
      "ticker": "BTC",
      "assetClass": "crypto",
      "status": "Wait",
      "risk": "High",
      "bias": "Neutral",
      "confidence": 60,
      "windowEnd": "2026-06-16T20:00:00Z",
      "hasPro": true,
      "url": "https://www.assetframe.co.uk/reports/2026-06-15/BTC"
    }
  ],
  "disclaimer": "AssetFrame publishes general market research ..."
}
```

## Get one report (free Snapshot)

```bash
curl "https://www.assetframe.co.uk/api/v1/reports/2026-06-15/BTC"
```
```json
{
  "id": "2026-06-15/BTC",
  "date": "2026-06-15",
  "instrument": "Bitcoin",
  "ticker": "BTC",
  "status": "Wait",
  "risk": "High",
  "confidence": 60,
  "windowEnd": "2026-06-16T20:00:00Z",
  "snapshotText": "AssetFrame Snapshot — Bitcoin (BTC) ...",
  "snapshotPdfUrl": "https://.../free.pdf?X-Amz-Expires=600...",
  "proAvailable": true,
  "proAccess": "Subscribe at https://www.assetframe.co.uk/pricing to unlock the full Pro analysis.",
  "disclaimer": "AssetFrame publishes general market research ..."
}
```
`snapshotPdfUrl` is a short-lived (~600s) signed link — fetch it promptly. A miss or malformed ref returns:
```json
{ "error": "not_found", "message": "No published report for that date/slug." }
```

## Get the track record

```bash
curl "https://www.assetframe.co.uk/api/v1/track-record"
```
```json
{
  "stats": { "reportsScored": 18, "openCalls": 3, "predictionsGraded": 54, "hitRate": 61.1, "longestStreak": 5, "currentStreak": 2 },
  "open": [ /* not-yet-graded calls with their predictions */ ],
  "scored": [ /* append-only graded calls */ ],
  "calibration": { "<=60": { "hitRate": 57.0, "n": 8 }, "61-75": { "hitRate": 64.0, "n": 7 }, ">75": { "hitRate": 80.0, "n": 3 } },
  "disclaimer": "AssetFrame publishes general market research ..."
}
```
(Illustrative numbers; the live values come from the ledger.)

## Fetch the OpenAPI schema

```bash
curl "https://www.assetframe.co.uk/api/v1/openapi.json"
```

## ChatGPT — Custom GPT Action

Create a Custom GPT, then Configure -> Actions -> Import from URL and paste the OpenAPI URL above. No auth required. The three operations (`listReports`, `getReport`, `getTrackRecord`) become callable Actions.

## LangChain (Python) tool wrapper

```python
import requests
from langchain_core.tools import tool

@tool
def list_assetframe_reports(asset_class: str = "", limit: int = 5) -> dict:
    """List AssetFrame report editions (free Snapshot metadata)."""
    r = requests.get(
        "https://www.assetframe.co.uk/api/v1/reports",
        params={"asset_class": asset_class or None, "limit": limit},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()
```

## CORS / browser

Because responses send `Access-Control-Allow-Origin: *`, a browser `fetch("https://www.assetframe.co.uk/api/v1/reports").then(r => r.json())` works from any origin.

## Notes

- These code samples mirror the live `/developers/api` page; the example payloads there are illustrative, the schema/data live at the URLs above.
- This is research data, not an execution API.

## Related docs

- `overview.md`, `endpoints.md`, `auth.md`.
- `../mcp/examples.md` — equivalent MCP client setup.
