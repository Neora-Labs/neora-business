import { resolve } from "node:path";
import type { OpportunityRepository } from "./persistence";
import { LocalFileOpportunityRepository } from "./persistence";
import { PostgresOpportunityRepository } from "./postgres-repository";

type RuntimeEnvironment = Record<string, string | undefined>;

export interface OpportunityRepositoryRuntime {
  mode: "local-demo" | "postgres";
  repository: OpportunityRepository;
  close?: () => Promise<void>;
}

export function createOpportunityRepository(environment: RuntimeEnvironment = process.env): OpportunityRepositoryRuntime {
  if (environment.NODE_ENV !== "production" && environment.NEORA_LOCAL_DEMO === "true") {
    const directory = resolve(/* turbopackIgnore: true */ environment.NEORA_DEMO_DATA_DIR ?? "data/runtime");
    return { mode: "local-demo", repository: new LocalFileOpportunityRepository(resolve(directory, "neora-demo.json")) };
  }
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required unless NEORA_LOCAL_DEMO=true");
  const repository = new PostgresOpportunityRepository(environment.DATABASE_URL);
  return { mode: "postgres", repository, close: () => repository.close() };
}
