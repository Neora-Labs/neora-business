import { describe, expect, it } from "vitest";
import { InMemoryImportRepository, canPublishDataset, hasPermission } from "../src/index";

describe("import idempotency and publication policy", () => {
  it("does not create duplicate dataset versions for the same SHA-256 checksum", () => {
    const repository = new InMemoryImportRepository();
    const first = repository.register({ checksum: "abc", sourceId: "sample", rawUri: "s3://bucket/a.csv" });
    const second = repository.register({ checksum: "abc", sourceId: "sample", rawUri: "s3://bucket/a.csv" });
    expect(second).toEqual({ ...first, duplicate: true });
    expect(repository.count()).toBe(1);
  });

  it("blocks publication until the source license is reviewed", () => {
    expect(canPublishDataset({ licenseReviewStatus: "pending", qualityStatus: "passed" })).toBe(false);
    expect(canPublishDataset({ licenseReviewStatus: "approved", qualityStatus: "passed" })).toBe(true);
  });
});

describe("role authorization", () => {
  it("restricts imports and model activation to the declared roles", () => {
    expect(hasPermission("administrator", "activate_model")).toBe(true);
    expect(hasPermission("analyst", "run_import")).toBe(true);
    expect(hasPermission("commercial_partner", "run_import")).toBe(false);
    expect(hasPermission("technical_partner", "activate_model")).toBe(false);
  });
});
