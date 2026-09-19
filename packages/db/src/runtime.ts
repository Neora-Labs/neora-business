import { resolve } from "node:path";
import type { OpportunityRepository } from "./persistence";
import { LocalFileOpportunityRepository } from "./persistence";
import { PostgresOpportunityRepository } from "./postgres-repository";

type RuntimeEnvironment = Record<string, string | undefined>;

export interface OpportunityRepositoryRuntimeOptions {
  localDemoBaseDirectory?: string;
}

export interface OpportunityRepositoryRuntime {
  mode: "local-demo" | "postgres";
  repository: OpportunityRepository;
  close?: () => Promise<void>;
}

export function resolveLocalDemoDataDirectory(
  environment: RuntimeEnvironment = process.env,
  options: OpportunityRepositoryRuntimeOptions = {},
): string {
  const baseDirectory = options.localDemoBaseDirectory ?? process.cwd();
  return resolve(baseDirectory, environment.NEORA_DEMO_DATA_DIR ?? "data/runtime");
}

export function resolveLocalDemoRepositoryPath(
  environment: RuntimeEnvironment = process.env,
  options: OpportunityRepositoryRuntimeOptions = {},
): string {
  return resolve(resolveLocalDemoDataDirectory(environment, options), "neora-demo.json");
}

export function createOpportunityRepository(
  environment: RuntimeEnvironment = process.env,
  options: OpportunityRepositoryRuntimeOptions = {},
): OpportunityRepositoryRuntime {
  if (environment.NODE_ENV !== "production" && environment.NEORA_LOCAL_DEMO === "true") {
    const repositoryPath = resolveLocalDemoRepositoryPath(environment, options);
    return { mode: "local-demo", repository: new LocalFileOpportunityRepository(/* turbopackIgnore: true */ repositoryPath) };
  }
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required unless NEORA_LOCAL_DEMO=true");
  const repository = new PostgresOpportunityRepository(environment.DATABASE_URL);
  return { mode: "postgres", repository, close: () => repository.close() };
}
