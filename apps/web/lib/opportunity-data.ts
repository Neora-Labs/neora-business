import type { ImportRunRecord, OpportunityImportBundle, OpportunityRepository } from "@neora/db";
import { sectorScoreSchema, type SectorScoreContract } from "@neora/contracts";
import { authorize, type AppIdentity } from "./auth";

export class AccessDeniedError extends Error {
  readonly status = 403;
  constructor() { super("Forbidden"); }
}

export async function loadMarkets(
  repository: OpportunityRepository,
  identity: AppIdentity | null
): Promise<SectorScoreContract[]> {
  if (!authorize(identity, "view_markets")) throw new AccessDeniedError();
  const scores: OpportunityImportBundle["scores"] = await repository.listMarketScores({ researchMode: identity?.mode === "local-demo" });
  return scores.map((score) => sectorScoreSchema.parse(score));
}

export async function loadImportRuns(
  repository: OpportunityRepository,
  identity: AppIdentity | null,
  limit = 20
): Promise<ImportRunRecord[]> {
  if (!authorize(identity, "run_import")) throw new AccessDeniedError();
  return repository.listImportRuns({ limit });
}
