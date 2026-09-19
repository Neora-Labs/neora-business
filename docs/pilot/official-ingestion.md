# Official-source ingestion

The administrative route is `/admin/imports`. It is deliberately separate from the market dashboard and accepts only the registered Bogotá pilot sources: EMICRON 2025 and ICA 2007–2023.

## Flow

1. An administrator selects a local file and supplies its period and version. The browser calculates SHA-256.
2. The server creates a short-lived conditional S3 PUT for `raw/sha256/<sha256>/<filename>`. It carries `If-None-Match: *`; an existing object is never overwritten.
3. Only after the browser reports a successful direct upload is an import request created as `pending_review`.
4. A different authorized identity approves or rejects it. PostgreSQL enforces `reviewed_by <> proposed_by`.
5. A separate worker claims `approved` requests with `FOR UPDATE SKIP LOCKED`, changes the state to `processing`, and writes `completed`, `failed`, or `blocked_mapping`.

No S3 bucket, role, or secret is provisioned by this repository. Without `RAW_ASSET_BUCKET` the UI fails closed before uploading anything.

## Source-specific rules

- `ciiu_4ac_2022` is the only pilot classification and outputs are divisions only.
- EMICRON uses `COD_DEPTO = "11" AND AREA = "11"`, aggregates with `F_EXP`, and uses `GRUPOS12`. It is `group_12` context—not a division metric—and carries a confidence penalty. Every used `Pxxxx` must have an official dictionary label.
- ICA is parsed as cp1252, semicolon-delimited raw observations. It creates no division metric until every relevant CIIU SHD value has a versioned, evidence-backed verified mapping. Unresolved values produce `blocked_mapping` / `insufficient_data`, never a guessed division.

## Worker boundary

`pipelines.src.official_worker` contains deterministic source transforms and must run outside Next.js. It receives immutable bytes plus admitted metadata and returns aggregate evidence only. It never receives or persists EMICRON micro-identifiers in the application database.
