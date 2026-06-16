# Storage — Report assets (free vs Pro keys)

## The five asset types per edition

| File | Tier | Gate |
| --- | --- | --- |
| `preview.png` | **public** | none — marketing thumbnail, cacheable |
| `free.html` | **free** | requires a signed-in Clerk session |
| `free.pdf` | **free** | requires a signed-in Clerk session |
| `pro.html` | **pro** | requires `subscribed` (paid or comped admin) |
| `pro.pdf` | **pro** | requires `subscribed` |

All five live in the private R2 bucket; tier is decided by the **filename**, validated against an anchored allow-list.

File: `C:\Users\cwatm\Desktop\advisor\mvp\web\lib\report-key.ts`

## The allow-list grammar

```
DATE = \d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])   # calendar-plausible
SLUG = [A-Za-z0-9_-]+
PRO_RE     = ^<DATE>/<SLUG>/pro\.(html|pdf)$
FREE_RE    = ^<DATE>/<SLUG>/free\.(html|pdf)$
PREVIEW_RE = ^<DATE>/<SLUG>/preview\.png$
```

`classifyReportKey(key)` returns `"pro" | "free" | "public" | null`:
- matches `PRO_RE` -> `"pro"`
- matches `FREE_RE` -> `"free"`
- matches `PREVIEW_RE` -> `"public"`
- otherwise -> `null`

The patterns are **anchored** (`^...$`) and **linear** (no nested quantifiers), so they are not ReDoS-prone and they reject path traversal (`../`), alternate separators, query strings, fragments, double extensions, wrong-case literals, and any non-report object. A `null` classification makes the gated route return **400** — the object is never signed.

## Key storage in the database

`editions` stores the keys:

| Column | Value |
| --- | --- |
| `free_html_key` | route/key for the free HTML |
| `free_pdf_key` | route/key for the free PDF |
| `preview_key` | preview PNG |
| `pro_html_key` | R2 object key (private) |
| `pro_pdf_key` | R2 object key (private) |

In `catalog.json` / the editions upsert, the free/preview values are stored as the **API routes** (`/api/report/<date>/<slug>/free.html`, etc.), while the Pro keys are **derived** in `sync-db.mjs` as the bare object keys `"<date>/<slug>/pro.html"` / `.../pro.pdf` and only when `has_pro` is true (else `null`). Either way, the gated route reconstructs the bare object key from the URL path before signing. See [../database/sync-db.md](../database/sync-db.md).

## free vs Pro — the practical difference

- A **free** key (`free.*`) and a **public** key (`preview.png`) both exist for every edition; a **Pro** key exists only when `has_pro`.
- The gate escalates by tier: public (anyone) -> free (any signed-in user) -> pro (`subscribed`). An admin reads Pro because `subscribed` includes comped admins (unless `adminTier:"free"`).
- The Pro object keys are **not** exposed on the public `Edition` type. `getEditionProKeys(date, slug)` (in `lib/content.ts`) returns them only DB-side, for the OAuth-gated MCP Pro tool. See [../auth/entitlement-checks.md](../auth/entitlement-checks.md).

## `isValidReportRef(date, slug)`

A sibling validator for the public REST API and MCP detail endpoints. Same `DATE`/`SLUG` grammar, plus a `SLUG_MAX = 64` length cap, used to reject malformed `date`/`slug` **before** any DB lookup (defence in depth — the lookups are already parameterized). See [../security/input-validation.md](../security/input-validation.md).

## Tests

`tests/sec-report-key.test.ts` and `tests/report-key.test.ts`:
- traversal payloads (`../secret`, `..%2f`, embedded `../`, backslashes, `....//`) all classify `null`;
- malformed/non-report keys (`pro.exe`, `metadata.json`, `preview.jpg`, `.env`, month 13/00, day 32, spaces, query/fragment, double-extension, empty slug, wrong case) all classify `null`;
- only the three intended tiers classify;
- `isValidReportRef` accepts good `date`+`slug` (incl. `SOL_2`, `BRK-B`), rejects traversal/separators/impossible dates/empty + 65-char slugs, accepts the 64-char boundary.

## Related docs

- [signed-urls.md](./signed-urls.md) · [r2.md](./r2.md) · [../security/input-validation.md](../security/input-validation.md)
