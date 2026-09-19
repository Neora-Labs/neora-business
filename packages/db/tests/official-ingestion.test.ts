import { describe, expect, it } from "vitest";
import {
  CIIU_4AC_2022,
  InMemoryOfficialIngestionRepository,
  createPresignedUploadPlan,
  requestSourceImport,
  reviewSourceImport,
} from "../src/index";

const checksum = "a".repeat(64);
const request = (proposedBy = "proposer") => ({
  sourceKind: "emicron" as const,
  fileName: "emicron.csv",
  checksumSha256: checksum,
  byteSize: 12,
  officialUrl: "https://microdatos.dane.gov.co/index.php/catalog/914/data-dictionary",
  licenseName: "official-open-data",
  period: "2025",
  datasetVersion: "2025",
  proposedBy,
  variableLabels: { P4001: "Internet use" },
});

describe("official source ingestion workflow", () => {
  it("uses an immutable checksum key and refuses an overwrite", () => {
    expect(createPresignedUploadPlan({ checksumSha256: checksum, fileName: "EMICRON 2025.csv" }).key)
      .toBe(`raw/sha256/${checksum}/EMICRON-2025.csv`);
    expect(() => createPresignedUploadPlan({ checksumSha256: checksum, fileName: "../../escape.csv" })).toThrow();
  });

  it("requires a distinct authorized reviewer before queueing work", () => {
    const repository = new InMemoryOfficialIngestionRepository();
    const created = requestSourceImport(repository, request());
    expect(() => reviewSourceImport(repository, created.id, { reviewerId: "proposer", decision: "approved" })).toThrow(/different/i);
    expect(reviewSourceImport(repository, created.id, { reviewerId: "reviewer", decision: "approved" }).status).toBe("approved");
  });

  it("records the pilot CIIU version and blocks ICA without verified mappings", () => {
    const repository = new InMemoryOfficialIngestionRepository();
    const created = requestSourceImport(repository, { ...request(), sourceKind: "ica", variableLabels: {} });
    const approved = reviewSourceImport(repository, created.id, { reviewerId: "reviewer", decision: "approved" });
    expect(approved.ciiuVersion).toBe(CIIU_4AC_2022);
    expect(repository.claimNext("worker-1")).toMatchObject({ id: created.id, status: "processing" });
    expect(repository.completeIca(created.id, [{ sourceCode: "1234", sourceDescription: "Activity" }]).status).toBe("blocked_mapping");
  });
});
