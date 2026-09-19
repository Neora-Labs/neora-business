import type { AppRole, ImportRunRecord, OpportunityImportBundle, OpportunityRepository } from "@neora/db";
import { describe, expect, it, vi } from "vitest";
import type { AppIdentity } from "./auth";
import { loadImportRuns, loadMarkets } from "./opportunity-data";

const score: OpportunityImportBundle["scores"][number] = {
  id: "score-1", city: "Bogotá", sectorCode: "health", sector: "Health", period: "2025", score: 80, confidence: 90,
  confidenceLabel: "high", status: "scored", modelVersion: "1.0.0", confidenceModelVersion: "1.0.0", factors: [],
  confidenceFactors: [], evidence: [], source: { name: "Test", url: null, observedAt: "2025-12-31", licenseReviewStatus: "approved" }
};
const run = { id: "run-1", status: "completed" } as ImportRunRecord;
const repository: OpportunityRepository = {
  persistImport: vi.fn(),
  findRoleByClerkUserId: vi.fn(),
  findPreferredLocaleByClerkUserId: vi.fn(),
  updatePreferredLocaleByClerkUserId: vi.fn(),
  persistProspectImport: vi.fn(),
  listProspects: vi.fn(),
  summarizeProspects: vi.fn(),
  updateProspect: vi.fn(),
  listMarketScores: vi.fn().mockResolvedValue([score]),
  listImportRuns: vi.fn().mockResolvedValue([run])
};
const identity = (role: AppRole, mode: AppIdentity["mode"] = "clerk"): AppIdentity => ({ userId: "user-1", role, mode });

describe("repository-backed opportunity data", () => {
  it("requires view_markets and enables pending synthetic data only for explicit local demo", async () => {
    expect(await loadMarkets(repository, identity("analyst"))).toEqual([score]);
    expect(repository.listMarketScores).toHaveBeenLastCalledWith({ researchMode: false });
    expect(await loadMarkets(repository, identity("administrator", "local-demo"))).toEqual([score]);
    expect(repository.listMarketScores).toHaveBeenLastCalledWith({ researchMode: true });
    await expect(loadMarkets(repository, null)).rejects.toMatchObject({ status: 403 });
  });

  it.each(["administrator", "analyst"] as const)("allows %s to inspect imports", async (role) => {
    await expect(loadImportRuns(repository, identity(role))).resolves.toEqual([run]);
  });

  it.each(["commercial_partner", "technical_partner"] as const)("rejects %s from import history", async (role) => {
    await expect(loadImportRuns(repository, identity(role))).rejects.toMatchObject({ status: 403 });
  });
});
