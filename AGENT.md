# Agent handbook

Use this file as the repository-level operating guide. The project is a pnpm modular monolith with a separate Python ingestion workspace; preserve the boundary between ingestion, deterministic scoring, persistence, and presentation.

## Quick path

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item .env.example apps/web/.env.local
corepack pnpm import:sample
corepack pnpm dev
```

Open `http://localhost:3000`. The sample is synthetic and local demo mode must be explicitly enabled with `NEORA_LOCAL_DEMO=true`.

Before handing off a change, run the smallest relevant checks and then the repository gates:

```powershell
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

Docker is a hard prerequisite for `corepack pnpm test:integration`. Run `corepack pnpm test:e2e` for the browser boundary. Neither suite may be reported as passing when its prerequisite is unavailable.

## Instruction scope

- This root `AGENT.md` is the project handbook requested by the maintainers.
- `apps/web/AGENTS.md` is a Next.js-generated, directory-scoped rule file. Do not delete or duplicate its generated block. When changing `apps/web`, follow it in addition to this handbook and read the relevant installed Next.js 16 documentation under `node_modules/next/dist/docs/`.
- `apps/web/CLAUDE.md` delegates to that generated file. Keep the relationship intact.
- If a future repository-level `AGENTS.md` is introduced for automatic agent discovery, keep it short and point here rather than maintaining two competing handbooks.

## Repository map

| Path | Responsibility | Change with |
|---|---|---|
| `apps/web` | Next.js 16 server-rendered UI, read APIs, Clerk identity, Sentry bootstrap | `packages/contracts`, `packages/db`, `packages/ui` |
| `packages/scoring` | Pure, versioned opportunity and confidence calculations | tests and model-version persistence |
| `packages/contracts` | Zod wire contracts and generated JSON Schema | `schemas/sector-score.v1.schema.json` |
| `packages/db` | Repository ports/adapters, authorization policies, Drizzle schema, SQL migrations, raw-asset adapters | migrations and integration tests |
| `packages/ui` | Shared accessible React primitives | consuming UI tests/type checks |
| `pipelines` | Python 3.12 discovery, acquisition, raw validation, normalization, handoff | Python tests and TS import contract |
| `scripts` | Synthetic artifact generation and end-to-end import orchestration | generated artifact and import tests |
| `data/samples` | Checked-in synthetic input only | provenance docs and generated output |
| `docs/decisions` | Durable architecture decisions | a new ADR when a decision changes |

See [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries and data flow.

## Commands

| Intent | Command | Notes |
|---|---|---|
| Generate deterministic sample scores | `corepack pnpm data:sample` | Rewrites `apps/web/data/market-scores.generated.json` |
| Import the sample | `corepack pnpm import:sample` | Reads `apps/web/.env.local`; runs Python then TypeScript |
| Run unit tests | `corepack pnpm test` | Recurses through pnpm packages |
| Run Python tests | `uv run --project pipelines pytest pipelines/tests` | Install with `uv sync --project pipelines --all-groups` |
| Run DB/S3 integration | `corepack pnpm test:integration` | Requires a working Docker daemon |
| Run browser tests | `corepack pnpm test:e2e` | Seeds isolated local-demo storage and starts Next.js on port 3100 |
| Regenerate JSON Schema | `corepack pnpm contracts:generate` | Required after changing the Zod contract |
| Apply DB migrations | `corepack pnpm db:migrate` | Requires `DATABASE_URL` |

CI runs type checking, linting, unit tests, integration tests, build, E2E, and the Python suite. Keep local verification aligned with `.github/workflows/ci.yml`.

## Non-negotiable invariants

1. **Ingestion does not score.** Python acquires, validates, and normalizes. `packages/scoring` owns product scoring.
2. **Opportunity is not confidence.** Maintain separate models, versions, factors, values, and UI labels.
3. **Missing evidence stays missing.** Use `null`; never convert absence to zero. A score is emitted only when the model's available factor weight reaches `minimumCoverage`.
4. **Scores are reproducible.** Model definitions are versioned and scoring remains pure and deterministic. Do not introduce an LLM into the score path.
5. **Raw assets are immutable.** Address them by SHA-256. Production writes use conditional S3 creation; local demo writes use exclusive file creation.
6. **Dataset import is checksum-idempotent.** A repeated `(source, checksum)` reuses the dataset and records a distinct `duplicate` import run without duplicating metrics, scores, or evidence.
7. **Contracts have one source.** Change Zod in `packages/contracts/src/index.ts`, regenerate checked-in JSON Schema, and update both language boundaries together.
8. **Authorization fails closed.** Clerk proves identity; PostgreSQL `users.role` grants application access. No role row means HTTP 403. Never add a production default role.
9. **License state controls visibility.** Production market queries return approved sources only. Synthetic pending-license data is visible solely in explicit local research mode and cannot become an actionable lead view.
10. **The web app reads repositories.** Runtime pages and APIs use `OpportunityRepository`; the generated JSON file is an import/provenance artifact, not an authorization bypass.
11. **Evidence endpoints stay narrow.** Do not turn `/api/evidence/source` into a filesystem reader or URL proxy.
12. **Production cannot enter demo mode.** `NEORA_LOCAL_DEMO` and the test Clerk identity hook are ignored when `NODE_ENV=production`.

## Change workflows

### Data or normalization

1. Add a failing Python test in `pipelines/tests`.
2. Update connector, quality, or normalization code.
3. Run the Python suite.
4. Run `corepack pnpm import:sample` to prove the handoff and checksum match.
5. Run affected TypeScript and integration checks.

### Score model

1. Add a failing test in `packages/scoring/tests` for thresholds, missing data, ordering, or precision.
2. Change the named model version; do not silently alter an existing version's semantics.
3. Regenerate sample output and verify persisted model metadata and UI copy.
4. Preserve evidence IDs for every opportunity and confidence factor.

### Contract or database schema

1. Update the Zod or Drizzle source.
2. Add a forward-only SQL migration; never edit an applied migration to represent a new state.
3. Regenerate JSON Schema when the wire contract changes.
4. Update local and PostgreSQL adapters together.
5. Exercise integration tests for constraints, transactions, idempotency, and read filtering.

### Web or API

1. Read `apps/web/AGENTS.md` and the installed Next.js documentation relevant to the API being changed.
2. Keep identity resolution at the server boundary and permission checks in reusable domain-facing functions.
3. Validate repository output with the shared Zod contract before presentation.
4. Add focused Vitest coverage; add Playwright only for a browser-visible contract.

## Environment and security boundaries

- Put local secrets in `apps/web/.env.local`, not the repository-root `.env.local`; both Next.js and `import:sample` are wired to the app-local file.
- Never commit `.env*`, credentials, production exports, Clerk identifiers, database dumps, or raw licensed data.
- `NEORA_LOCAL_DEMO=true` is an explicit credential-free development mode. Without it, `DATABASE_URL` is mandatory.
- Production import also requires `RAW_ASSET_BUCKET`; `AWS_REGION` defaults to `sa-east-1`. `S3_ENDPOINT` exists only for S3-compatible testing.
- Seed Clerk-to-role mappings manually with `packages/db/seeds/roles.sql`. Do not make user provisioning a public application endpoint.
- The application exposes import status but does not launch remote ingestion jobs.

## Generated and transient files

- **Tracked:** `apps/web/data/market-scores.generated.json`, `schemas/sector-score.v1.schema.json`, SQL migrations, synthetic fixture.
- **Untracked/transient:** `data/runtime`, `data/e2e-runtime`, `pipelines/raw`, `.next*`, test reports, coverage, Python caches, local environment files.
- If `data:sample` changes generated output unexpectedly, inspect the source fixture, checksum, model version, and generator before accepting the diff.

## Testing matrix

| Change | Minimum focused proof | Broader proof before handoff |
|---|---|---|
| Scoring | `packages/scoring/tests` | `pnpm test`, `pnpm typecheck`, regenerated sample |
| Pipeline | `pipelines/tests` | Python suite plus `pnpm import:sample` |
| Repository/persistence | `packages/db/tests` | Docker integration suite |
| Auth/API | relevant `apps/web/**/*.test.ts` | unit suite plus integration/E2E as applicable |
| UI behavior | component/data tests | Playwright E2E |
| Contract/schema | generation diff and typecheck | unit plus integration suites |
| Documentation only | paths, commands, and internal links | Markdown structural readback |

## Known gotchas

- The repository is currently a first vertical slice, not a full lead-generation platform. Company scoring, Lead Queue, Scoring Lab, exports, outreach, and multi-country support are intentionally absent.
- The synthetic fixture has 15 rows: five sectors across Bogotá, Medellín, and Cali. It is not official market evidence.
- `pnpm build` regenerates the sample artifact before building packages; generated-file drift is therefore a real change, not disposable build noise.
- Local repository writes use atomic rename but are not a multi-process database. Use PostgreSQL for production concurrency.
- Integration tests use PostgreSQL and LocalStack containers and may leave misleading results if Docker itself is unhealthy; honor the preflight failure.
- `OpportunityRepositoryRuntime` is memoized in the Next.js process. Tests that change environment mode should isolate the process or instantiate adapters directly.
- Vercel deploys the web application. Python ingestion is run locally or in GitHub Actions; there is no scheduler or queue in this repository.

## Documentation discipline

- Record durable architecture changes as numbered ADRs under `docs/decisions` and update `ARCHITECTURE.md` when the current-state model changes.
- Keep `README.md` as the human quick start, this file as the agent operating contract, and `ARCHITECTURE.md` as the system explanation. Avoid copying long sections between them.
- Document only behavior verified in source, configuration, migrations, or tests. Mark intended production topology as intended when infrastructure is not provisioned here.
