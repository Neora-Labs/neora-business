import { createOpportunityRepository, type OpportunityRepositoryRuntime } from "@neora/db";

let runtime: OpportunityRepositoryRuntime | undefined;

export function opportunityRuntime(): OpportunityRepositoryRuntime {
  runtime ??= createOpportunityRepository();
  return runtime;
}
