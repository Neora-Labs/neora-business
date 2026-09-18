# Neora Business Opportunity Index

A production-oriented first vertical slice for comparing five sectors across Bogotá, Medellín, and Cali. The demo uses **synthetic aggregate data**: it proves lineage, deterministic scoring, confidence separation, and evidence presentation without claiming official provenance.

## Bogotá pilot specification

The approved product target is narrower than the current demo: an internal ranking of **Bogotá × official CIIU division × reference period** using official open evidence and expert validation. Start with the [pilot specification index](docs/pilot/README.md), then use the [product requirements](docs/pilot/product-requirements.md), [data dictionary and source catalog](docs/pilot/data-dictionary-and-source-catalog.md), [scoring model card](docs/pilot/scoring-model-card.md), [expert validation protocol](docs/pilot/expert-validation.md), and [governance and operations](docs/pilot/governance-and-operations.md).

These documents identify future interface requirements explicitly. The current synthetic three-city application does not yet implement the CIIU universe, official production sources, expert records, or the full result-state lifecycle.

## Quick path

1. Install Node.js 22 and pnpm through Corepack: `corepack pnpm install`.
2. Copy `.env.example` to `apps/web/.env.local`; keep `NEORA_LOCAL_DEMO=true` for credential-free local use. The import command and Next.js both read that file.
3. Seed the local repository and start the dashboard: `corepack pnpm import:sample && corepack pnpm dev`, then open `http://localhost:3000`.
4. Run checks: `corepack pnpm test && corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build`.

## Data pipeline

Install `uv`, then run:

```powershell
uv sync --project pipelines --all-groups
uv run --project pipelines pytest pipelines/tests
uv run --project pipelines python -m pipelines.src.run_sample
```

The sample connector follows `discover → acquire → validate_raw → normalize → load manifest`. Acquired files use SHA-256 content-addressed paths. `pnpm import:sample` runs Python normalization and the TypeScript loader. Reimporting a checksum records a new `duplicate` import run while reusing the raw object and existing dataset, metrics, scores, and evidence.

`pnpm data:sample` generates the UI artifact directly from the fixture, records its SHA-256 checksum, and runs the shared deterministic TypeScript scoring model. The build regenerates this artifact to prevent hand-copied demo results.

## Database and cloud configuration

- Apply the versioned SQL migrations in `packages/db/migrations/` to a Neon PostgreSQL database in `sa-east-1`.
- Configure an S3 bucket in `sa-east-1` with versioning, encryption, and public access blocked; set `RAW_ASSET_BUCKET` and standard AWS credentials in the runtime, never in source.
- Configure Vercel from the repository root; `vercel.json` pins functions to `gru1`.
- Configure Clerk as invite-only. Clerk supplies identity; `users.role` in PostgreSQL remains authoritative.
- Provision Clerk IDs manually and audibly with `packages/db/seeds/roles.sql`. An authenticated Clerk user without a row in `users` receives HTTP 403; there is no default role.
- Set `SENTRY_DSN` to enable server error reporting. Without it, local demo remains functional.

The web runtime uses local file persistence only when `NEORA_LOCAL_DEMO=true`. Otherwise `DATABASE_URL` is mandatory. `GET /api/markets` enforces `view_markets` and license filtering. `GET /api/imports` is restricted to administrators and analysts and reports status only; the application never starts remote jobs.

## Integration and browser verification

Docker is required for the PostgreSQL and LocalStack integration harness. The
suite checks `docker info` first and fails with an actionable prerequisite
message when Docker is unavailable; it never reports a fabricated pass or
silently skips the integration boundary:

```powershell
pnpm test:integration
pnpm test:e2e
```

The integration test applies the real SQL migrations to an isolated PostgreSQL container, runs the Python normalizer and TypeScript importer twice, and verifies S3 immutability, database idempotency, model definitions, role lookup, license filtering, and import history. A missing Docker runtime is a test failure, not a skipped or fabricated pass. Playwright seeds an isolated local-demo repository and verifies the repository-backed UI and GET APIs.

## Packages

| Area | Location | Responsibility |
|---|---|---|
| Web/API | `apps/web` | Market Explorer, validated API seams, local-demo auth hook |
| Scoring | `packages/scoring` | Pure versioned opportunity and confidence helpers |
| Contracts | `packages/contracts` | Zod schemas and generated JSON Schema |
| Database | `packages/db` | Drizzle schema, SQL migration, roles, import and S3 seams |
| UI | `packages/ui` | Accessible shared primitives |
| Pipeline | `pipelines` | Python 3.12 acquisition, validation, normalization, storage |

## Safety and current limits

- The fixture is synthetic and license status is pending, so no actionable lead view is exposed.
- No cloud resource, credential, official dataset, company record, scraping, outreach, or deployment is created.
- Company scoring, Lead Queue, Scoring Lab, CSV export, commercial outcomes, and multi-country expansion remain later work.
- Production authorization resolves Clerk identities to PostgreSQL-managed application roles.
