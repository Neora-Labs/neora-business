# ADR 0001: Start as a modular monolith

## Decision

Use one Next.js web/API application, versioned TypeScript packages, and a separate Python data workspace. Store relational lineage and scores in PostgreSQL and immutable raw assets in versioned S3 storage.

## Why

This proves the data-to-ranking flow without the operational cost of microservices or a workflow orchestrator. A deterministic scoring package keeps numerical decisions reproducible and independent from UI and generative AI.

## Guardrails

- Python acquires, validates, normalizes, and loads data; it does not calculate product scores.
- Opportunity and confidence are separate values; missing evidence remains `null`.
- PostgreSQL is the authorization and audit authority; Clerk supplies identity only.
- Raw files use content-addressed S3 keys and bucket versioning. No bucket is provisioned by this repository.
- The synthetic fixture cannot be published into actionable lead views.

## Revisit when

Job duration exceeds platform limits, ingestion cadence justifies orchestration, or production moves to an EU data region.
