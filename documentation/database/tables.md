# Database — Tables and columns

Every table, every column, grounded in `web/migrations/*.js`. Types are the literal `CREATE TABLE` types. Columns added by later migrations are noted with the migration that added them.

> Convention: edition id and most `report_id`-style join keys are the string `"<date>/<slug>"` (e.g. `2026-06-15/ETH`), **except** `open_calls.report_id` / `scored_results.report_id` which use the ledger form `AF-YYYYMMDD-SLUG` (e.g. `AF-20260615-AAPL`). The catalogue join in `lib/content.ts` bridges the two.

---

## `editions` — published report catalogue

One row per published edition. Source: `init`; `hidden` from `edition-hidden`; the six `*_key`/taxonomy columns split between `init` and `track_record_analytics`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | `"<date>/<slug>"` |
| `report_date` | `date NOT NULL` | |
| `slug` | `text NOT NULL` | e.g. `ETH`, `BRK-B` |
| `instrument` | `text NOT NULL` | display name |
| `ticker` | `text` | |
| `asset_class` | `text` | human label |
| `status` | `text` | e.g. `Wait` / `Buy` / `Sell` |
| `risk` | `text` | `Low`..`Very High` |
| `bias` | `text` | directional bias text |
| `data_quality` | `int` | 0–10 |
| `window_end` | `text` | scoring-window end (stored as text) |
| `catalyst_status` | `text` | |
| `has_pro` | `boolean DEFAULT false` | whether a Pro edition exists |
| `free_html_key` | `text` | route/key for free HTML |
| `free_pdf_key` | `text` | route/key for free PDF |
| `preview_key` | `text` | preview PNG |
| `pro_html_key` | `text` | R2 object key (private) |
| `pro_pdf_key` | `text` | R2 object key (private) |
| `created_at` | `timestamptz DEFAULT now()` | |
| `hidden` | `boolean NOT NULL DEFAULT false` | **`edition-hidden`** — soft-unpublish |
| `asset_class_key` | `text` | **`track_record_analytics` (T12)** — normalized key |
| `direction_view` | `text` | **T12** |
| `prediction_type` | `text` | **T12** |
| `market_regime` | `text` | **T12** |
| `confidence_band` | `text` | **T12** — nullable; cron falls back when absent |
| `social_context` | `jsonb` | **T12** |

Indexes: `editions_date_idx (report_date DESC)`, `editions_asset_idx (asset_class)`, `editions_ticker_idx (ticker)`.

Hidden editions disappear from catalogue, sitemap, and reader (404) but stay in the DB; the R2 files are untouched, so an admin can restore them.

---

## `open_calls` — predictions awaiting scoring

Source: `init`; `hits` + `scored` from `call-hits`. Note: `init` defined this with the `predictions jsonb` denormalised column, which `open-call-predictions` then **drops** in favour of the child table.

| Column | Type | Notes |
| --- | --- | --- |
| `report_id` | `text` PK | `AF-YYYYMMDD-SLUG` |
| `instrument` | `text` | |
| `symbol` | `text` | |
| `view` | `text` | the call's directional view |
| `confidence` | `text` | research confidence (stored as text) |
| `window_end` | `text` | |
| `n` | `int` | total predictions |
| `n_manual` | `int` | manual predictions |
| `hits` | `int DEFAULT 0` | **`call-hits`** — confirmed-true count (0 while open) |
| `scored` | `boolean DEFAULT false` | **`call-hits`** — flips true after scoring |

(The `predictions jsonb` column from `init` is removed by `open-call-predictions`; its `down` re-adds it.)

---

## `open_call_predictions` — sub-predictions P1..Pn

Source: `open-call-predictions`; three T12 columns from `track_record_analytics`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `report_id` | `text NOT NULL` | **FK → `open_calls(report_id)` ON DELETE CASCADE** |
| `seq` | `int` | order within the report (1..n) |
| `pred_id` | `text` | `"P1".."Pn"` |
| `type` | `text` | `close_above`, `range_inside`, `manual`, … |
| `text` | `text` | human-readable prediction |
| `manual` | `boolean DEFAULT false` | |
| `expect` | `boolean` | predicted direction (null for manual/NT) |
| `pred_type` | `text` | **T12** — per-prediction archetype |
| `verdict` | `text` | **T12** — `Y`/`N`/`NT`/`""` once scored |
| `setup_side` | `text` | **T12** — reserved |

Constraint: `UNIQUE (report_id, pred_id)`. Index: `ocp_report_idx (report_id)`.

---

## `scored_results` — scored outcome snapshot

Source: `init`; two T12 columns from `track_record_analytics`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `report_id` | `text` | `AF-YYYYMMDD-SLUG` (nullable) |
| `instrument` | `text` | |
| `view` | `text` | |
| `confidence` | `text` | |
| `results` | `text` | packed per-prediction results string |
| `hits` | `int` | |
| `misses` | `int` | |
| `hit_rate` | `text` | |
| `window_end` | `text` | |
| `scored_at` | `timestamptz DEFAULT now()` | |
| `conf_version` | `int` | **T12** — confidence-model version |
| `confidence_components` | `jsonb` | **T12** — component breakdown |

No declared indexes.

---

## `download_log` — Pro file fetch log

Source: `download-log`. One row per Pro file fetched through `/api/report`; free files use the same gated route but are **not** logged here. Writes are deduped per `(user, report, kind)` per hour by the route handler.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `report_id` | `text` | `"<date>/<slug>"` |
| `kind` | `text` | `'html'` \| `'pdf'` |
| `user_id` | `text` | best-effort email; nullable |
| `ts` | `timestamptz DEFAULT now()` | |

Indexes: `download_log_ts_idx (ts)`, `download_log_report_idx (report_id)`.

---

## `billing_subscriptions` — Lemon Squeezy → Clerk mapping

Source: `billing-subscriptions`. Durable mapping so revokes/refunds find the right user even after an email change. See [../billing/webhooks.md](../billing/webhooks.md).

| Column | Type | Notes |
| --- | --- | --- |
| `subscription_id` | `text` PK | Lemon Squeezy subscription id |
| `ls_customer_id` | `text` | LS customer id |
| `clerk_user_id` | `text NOT NULL` | resolved account |
| `status` | `text` | last LS status |
| `updated_at` | `text` | LS event `updated_at` (ISO) — used for staleness/idempotency |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes: `billing_subscriptions_user_idx (clerk_user_id)`, `billing_subscriptions_customer_idx (ls_customer_id)`.

---

## `admin_audit_log` — privileged + billing action trail

Source: `admin-audit-log`. Holds no new PII beyond emails already in Clerk.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `ts` | `timestamptz NOT NULL DEFAULT now()` | |
| `actor` | `text` | admin email, `'webhook'`, or `'clerk'` |
| `action` | `text NOT NULL` | `grant_pro` \| `revoke_pro` \| `revalidate` \| `billing_grant` \| `billing_revoke` \| `grant_unresolved` (plus `revoke_unresolved`, `billing_cancel_on_delete`, `user_deleted` emitted by code) |
| `target` | `text` | affected member email / subscription id |
| `detail` | `text` | freeform context |

Indexes: `admin_audit_log_ts_idx (ts DESC)`, `admin_audit_log_target_idx (target)`, `admin_audit_log_action_idx (action)`.

> NOTE: the comment in the migration lists a fixed action set, but the code (`app/api/webhooks/*`, `lib/audit.ts`) also writes `revoke_unresolved`, `billing_cancel_on_delete`, and `user_deleted`. The `action` column is free text, so this is expected.

---

## `feedback` — public feedback / feature-request inbox

Source: `feedback`. Anonymous feedback is allowed (`email`/`clerk_user_id` optional).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `email` | `text` | optional reply-to |
| `clerk_user_id` | `text` | set if signed in |
| `category` | `text NOT NULL DEFAULT 'general'` | `feature`\|`bug`\|`data`\|`general`\|`other` |
| `message` | `text NOT NULL` | |
| `status` | `text NOT NULL DEFAULT 'new'` | `new`\|`triaged`\|`planned`\|`done`\|`declined` |
| `admin_notes` | `text` | |
| `user_agent` | `text` | light spam-triage context |

Indexes: `feedback_status_idx (status)`, `feedback_created_idx (created_at DESC)`.

---

## `subscribers` — newsletter audience (double opt-in)

Source: `subscribers`. Double opt-in for UK PECR/GDPR.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `email` | `text NOT NULL UNIQUE` | |
| `status` | `text NOT NULL DEFAULT 'pending'` | `pending`\|`confirmed`\|`unsubscribed` |
| `topics` | `text[] NOT NULL DEFAULT '{}'` | `'digest'` or instrument symbols |
| `clerk_user_id` | `text` | |
| `confirm_token` | `text` | double opt-in confirm link |
| `unsub_token` | `text NOT NULL` | one-click unsubscribe |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `confirmed_at` | `timestamptz` | |
| `unsubscribed_at` | `timestamptz` | |

Indexes: `subscribers_status_idx (status)`, unique `subscribers_unsub_token_idx (unsub_token)`.

---

## `watchlists` — per-user followed instruments

Source: `watchlists`. `UNIQUE (clerk_user_id, symbol)` keeps follows idempotent.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `clerk_user_id` | `text NOT NULL` | |
| `symbol` | `text NOT NULL` | edition slug followed |
| `instrument` | `text` | display label |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes: `watchlists_user_idx (clerk_user_id)`, `watchlists_symbol_idx (symbol)`.

---

## `report_views` — per-day view counter

Source: `report-views`. Trending = sum of the last 7 days. `edition_id` matches `editions.id`.

| Column | Type | Notes |
| --- | --- | --- |
| `edition_id` | `text NOT NULL` | part of composite PK |
| `day` | `date NOT NULL` | part of composite PK |
| `count` | `bigint NOT NULL DEFAULT 0` | |

PK: `(edition_id, day)`. Index: `report_views_day_idx (day)`.

---

## `push_subscriptions` — Web Push endpoints (Task T16)

Source: `push_subscriptions`. One row per browser/device push endpoint. `endpoint` is unique so re-subscribing upserts in place.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `clerk_user_id` | `text` | nullable in schema; save action requires login, so in practice always set |
| `endpoint` | `text NOT NULL UNIQUE` | push service endpoint |
| `p256dh` | `text NOT NULL` | client public key |
| `auth` | `text NOT NULL` | auth secret |
| `topics` | `text[] NOT NULL DEFAULT '{}'` | `'digest'` or symbols; empty = digest-by-default |
| `created_at` | `timestamptz DEFAULT now()` | |
| `last_seen_at` | `timestamptz` | refreshed on upsert |

Index: `push_subscriptions_user_idx (clerk_user_id)`.

Operational notes: the new-editions cron prunes rows whose endpoint the push service reports as gone (404/410). The `removeSubscription` action scopes deletes to `endpoint = $1 AND clerk_user_id = $2` so a user can only delete their own row. See `lib/push.ts`, `lib/push-actions.ts`.

---

## `social_engagement` — marketing distribution metrics (Task T17)

Source: `social_engagement`. **MARKETING-ONLY** — firewalled from the research/confidence/scoring path (`scripts/test_firewall.py` enforces nothing in scoring reads this table). `post_ref` is the platform's own post id/url; `report_id` links a snapshot to the edition it promoted (nullable for brand posts).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigserial` PK | |
| `platform` | `text NOT NULL` | `'x'`\|`'linkedin'`\|`'newsletter'`\|`'reddit'`\|… |
| `post_ref` | `text` | platform post id/url |
| `report_id` | `text` | `"<date>/<slug>"`; nullable |
| `impressions` | `int DEFAULT 0` | |
| `engagements` | `int DEFAULT 0` | |
| `clicks` | `int DEFAULT 0` | |
| `captured_at` | `timestamptz DEFAULT now()` | |

Indexes: `social_engagement_report_idx (report_id)`, `social_engagement_captured_idx (captured_at)`.

> Firewall is a hard product rule: engagement must never feed back into a report's confidence, bias, or scoring.

## Related docs

- [schema.md](./schema.md) · [migrations.md](./migrations.md) · [sync-db.md](./sync-db.md)
