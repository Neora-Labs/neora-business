import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalFileOpportunityRepository, type OpportunityImportBundle } from "../src/index";

const bundle = (checksum = "a".repeat(64), licenseReviewStatus: "pending" | "approved" = "approved"): OpportunityImportBundle => ({
  source: { id: "source-1", name: "Synthetic sample", organization: "Neora Labs", officialUrl: null, countryCode: "CO", licenseName: null, licenseReviewStatus, isSynthetic: true },
  dataset: { id: "dataset-1", period: "2025", checksumSha256: checksum, downloadedAt: "2026-09-17T00:00:00.000Z", schemaVersion: "1", rawUri: `local-demo://raw/${checksum}.csv`, byteSize: 10 },
  importRun: { id: "run-1", codeVersion: "test", rowsRead: 1, rowsAccepted: 1, rowsRejected: 0 },
  models: {
    opportunity: { kind: "sector", version: "1.0.0", weights: { digital_gap: 20 }, minimumCoverage: 65 },
    confidence: { kind: "confidence", version: "1.0.0", weights: { authority: 30 }, minimumCoverage: 100 }
  },
  metrics: [{ id: "metric-1", city: "Bogotá", sectorCode: "health", sectorName: "Clinics", period: "2025", values: { digital_gap: 0.8 } }],
  scores: [{ id: "score-1", city: "Bogotá", sectorCode: "health", sector: "Clinics", period: "2025", score: 80, confidence: 90, confidenceLabel: "high", status: "scored", modelVersion: "1.0.0", confidenceModelVersion: "1.0.0", factors: [], confidenceFactors: [], source: { name: "Synthetic sample", url: null, observedAt: "2025-12-31", licenseReviewStatus }, evidence: [] }],
  audit: { id: "audit-1", actorId: "local-demo-user", action: "import.completed", occurredAt: "2026-09-17T00:00:00.000Z" }
});

describe("durable local persistence boundary", () => {
  it("survives repository recreation and makes repeated checksums idempotent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neora-store-"));
    const path = join(directory, "store.json");
    const first = await new LocalFileOpportunityRepository(path).persistImport(bundle());
    const second = await new LocalFileOpportunityRepository(path).persistImport(bundle());
    const stored = JSON.parse(await readFile(path, "utf8"));
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(stored.datasetVersions).toHaveLength(1);
    expect(stored.importRuns).toHaveLength(2);
    expect(stored.metrics).toHaveLength(1);
    expect(stored.scores).toHaveLength(1);
    expect(stored.auditEvents).toHaveLength(1);
    expect(await new LocalFileOpportunityRepository(path).listImportRuns({ limit: 10 })).toEqual([
      expect.objectContaining({ status: "duplicate", datasetVersionId: "dataset-1" }),
      expect.objectContaining({ status: "completed", datasetVersionId: "dataset-1" })
    ]);
  });

  it("enforces license review at the query boundary unless explicit research mode is enabled", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neora-store-"));
    const repository = new LocalFileOpportunityRepository(join(directory, "store.json"));
    await repository.persistImport(bundle(undefined, "pending"));
    expect(await repository.listMarketScores({ researchMode: false })).toEqual([]);
    expect(await repository.listMarketScores({ researchMode: true })).toHaveLength(1);
  });
});
