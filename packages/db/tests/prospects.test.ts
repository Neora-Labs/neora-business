import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  LocalFileOpportunityRepository,
  summarizeProspects,
  type ProspectImportBundle,
} from "../src/index";

const prospect = (externalId = "ext-1") => ({
  externalId,
  companyName: "Synthetic Company",
  sector: "Services",
  geography: "Bogotá" as const,
  publicUrl: "https://example.test",
  fitSignal: "Synthetic fit signal",
  initialProposal: "Synthetic proposal",
  priority: "A" as const,
  outreachStatus: "To contact",
  decisionMakerRole: "Operations",
});

const bundle = (checksum = "a".repeat(64)): ProspectImportBundle => ({
  import: { fileName: "synthetic-prospects.csv", checksumSha256: checksum, importedBy: "admin", importedAt: "2026-01-01T00:00:00.000Z" },
  prospects: [prospect(), prospect("ext-2")],
});

describe("prospect persistence", () => {
  it("imports prospects atomically and rejects repeated checksums", async () => {
    const repository = new LocalFileOpportunityRepository(join(tmpdir(), `neora-prospects-${crypto.randomUUID()}.json`));
    await expect(repository.persistProspectImport(bundle())).resolves.toMatchObject({ duplicate: false, importedCount: 2 });
    await expect(repository.persistProspectImport(bundle())).resolves.toMatchObject({ duplicate: true, importedCount: 0 });
    await expect(repository.listProspects({})).resolves.toMatchObject({ total: 2 });
  });

  it("keeps individual prospects separate while providing aggregate counts", () => {
    expect(summarizeProspects([prospect(), { ...prospect("ext-2"), sector: "Transport", outreachStatus: "Contacted", priority: "B" }])).toEqual({
      total: 2,
      bySector: [{ key: "Services", count: 1 }, { key: "Transport", count: 1 }],
      byStatus: [{ key: "Contacted", count: 1 }, { key: "To contact", count: 1 }],
      bogotaCount: 2,
    });
  });

  it("rejects records outside Bogotá even when callers bypass the web importer", async () => {
    const repository = new LocalFileOpportunityRepository(join(tmpdir(), `neora-prospects-${crypto.randomUUID()}.json`));
    await expect(repository.persistProspectImport({ ...bundle(), prospects: [{ ...prospect(), geography: "Medellín" as "Bogotá" }] })).rejects.toThrow(/Bogotá/i);
  });
});
