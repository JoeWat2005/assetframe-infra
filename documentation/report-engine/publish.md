# `publish.py` — upload report files to private R2

`scripts/publish.py` uploads each edition's report files to a **private** Cloudflare R2 bucket. R2 is S3-compatible, so it uses `boto3`. Object keys mirror the path the web app's `/api/report` route requests, and **every file is private** — nothing is public/static (module docstring lines 1–23).

## The R2 private-bucket model

From the docstring (lines 3–7) and `README.md` §8/§10:

> ALL report files — free Snapshots AND Pro reports — live in private R2 and are served only through the auth-gated `/api/report` route in the Next.js app (free needs an account, Pro needs a subscription). Nothing is public/static, so there is no way to read a report without going through the gate.

So `publish.py` never sets public ACLs or a public bucket — it just `put_object`s into a private bucket (`assetframe-pro`). Access control and signed URLs live entirely in the web app, not here.

## The file set

`UPLOAD_FILES` (lines 33–39) — five files per edition, each with its content type, **all private**:

| File | Content-Type |
|---|---|
| `free.html` | `text/html; charset=utf-8` |
| `free.pdf` | `application/pdf` |
| `preview.png` | `image/png` |
| `pro.html` | `text/html; charset=utf-8` |
| `pro.pdf` | `application/pdf` |

Note `metadata.json` is **not** uploaded — it is consumed locally by `export_content.py` and synced to Neon, not served from R2.

## Key layout (mirrors `/api/report`)

`discover()` (lines 58–70) globs `reports/*/*/metadata.json`, derives `date`/`slug` from the path, and builds keys `<date>/<slug>/<name>` for each existing upload file. This is exactly the path `/api/report` requests (docstring lines 21–22), so a request for `/api/report/2026-06-13/WTI/pro.pdf` maps 1:1 to the R2 object `2026-06-13/WTI/pro.pdf`.

Date directories starting with `_` are **skipped** (line 62) — dev/staging editions are never published.

## CLI

```
python scripts/publish.py            # upload every edition's free + Pro files
python scripts/publish.py --dry-run  # show what would upload, change nothing
python scripts/publish.py --date 2026-06-13   # only that edition date
```

`argparse` (lines 74–77): `--dry-run` (flag) and `--date YYYY-MM-DD` (filter). With `--dry-run`, it prints the would-be keys and **returns before loading env or boto3** (lines 84–88) — so a dry run works with no credentials installed.

If no report files are found under `reports/`, it prints a notice and returns (lines 80–82).

## Env vars + `.env.local` auto-load

Required (lines 91–97):

| Var | Meaning |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account id (→ endpoint `https://<id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | the private bucket name (e.g. `assetframe-pro`) |

`_load_local_env()` (lines 42–56) auto-populates any **missing** `R2_*` var from `web/.env.local` (parsing `KEY=VALUE` lines, skipping comments/blanks, never overwriting an already-set env var). This lets `python scripts/publish.py` work without exporting the four vars by hand. It runs only on the real upload path (after the dry-run early return, line 90).

The boto3 client is built S3-style against the R2 endpoint with `region_name="auto"` (lines 105–111), then each file is uploaded with `put_object(Bucket, Key, Body, ContentType)` (lines 112–114).

## The security rationale

The bucket is private by design and `publish.py` keeps it that way. Read access is enforced **by the web app, not here**:

- The web `/api/report` route generates **120-second signed URLs** for Pro files and gates on Clerk auth + active Pro entitlement (`README.md` §4, §8, §10). Free files still require an account.
- Pro files are **never** in the public bundle; report files are served only as short-lived signed URLs, never as public objects (`README.md` §10).
- This script has no concept of public/static delivery — it cannot accidentally expose a report. The only way to read one is through the auth-gated route.

This division (private storage here, signed-URL gating in the web app) is why `export_content.py` deliberately copies *no* report bytes into `web/` — see [`export-content.md`](./export-content.md).

## Exit codes

| Exit | Condition |
|---|---|
| `0` | success (including `--dry-run`, and the "no files found" early return) |
| `2` | **missing env vars** — prints which are missing, points at LAUNCH.md / `--dry-run` (lines 93–97); or **boto3 not installed** — `boto3 is required: pip install boto3` (lines 99–103) |

## Output (stdout)

Per upload: `uploaded  <key>`; then `Done - N file(s) to bucket '<bucket>'.` (lines 115–116). Dry-run prints `DRY RUN - would upload N file(s):` and the keys.

## Where this fits

Publishing routine (`README.md` §3 step 12, §8): `export_content.py` → **`publish.py`** → `web/scripts/sync-db.mjs`, after human review. Engine artifacts under `data/` stay local; only `web/content/*.json` + the ledger reach git/Neon, and the report files reach R2 via this script.

## Related docs

- [`generated-artifacts.md`](./generated-artifacts.md) — the six artifacts; which go to R2 (all) vs `web/content` (derived JSON only).
- [`export-content.md`](./export-content.md) — the metadata/paths bridge; the complementary "files NOT copied" rationale.
- [`mvp-report.md`](./mvp-report.md) — generates the files `publish.py` uploads.
- `../storage/` — R2 setup, the `/api/report` route, signed URLs.

## Tests

No dedicated test for `publish.py` (it is thin I/O over boto3). **`NOT VERIFIED`** by a unit test; verify with `python scripts/publish.py --dry-run` (no credentials needed) to confirm the discovered key set, then a real run against the `assetframe-pro` bucket. The web side's path-traversal guard on `/api/report` is covered by the Vitest security tests (`README.md` §9).
