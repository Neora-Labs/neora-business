import { resolve } from "node:path";
import { createOpportunityRepository, type OpportunityRepositoryRuntime } from "@neora/db";

let runtime: OpportunityRepositoryRuntime | undefined;

export function resolveWebWorkspaceRoot(currentWorkingDirectory: string = process.cwd()): string {
  return resolve(currentWorkingDirectory, "..", "..");
}

export function opportunityRuntime(): OpportunityRepositoryRuntime {
  runtime ??= createOpportunityRepository(process.env, { localDemoBaseDirectory: resolveWebWorkspaceRoot() });
  return runtime;
}
