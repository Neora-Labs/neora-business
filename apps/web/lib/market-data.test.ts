import { describe, expect, it } from "vitest";
import { marketScores, sampleLineage } from "./market-data";

describe("generated market sample", () => {
  it("contains all 15 city-sector scores with factor-level evidence", () => {
    expect(marketScores).toHaveLength(15);
    expect(new Set(marketScores.map((score) => score.city))).toEqual(new Set(["Bogotá", "Medellín", "Cali"]));
    expect(marketScores.every((score) => {
      const evidenceIds = new Set(score.evidence.map((evidence) => evidence.id));
      return score.factors.length === 7
        && score.confidenceFactors.length === 5
        && [...score.factors, ...score.confidenceFactors].every((factor) => evidenceIds.has(factor.evidenceId));
    })).toBe(true);
  });
  it("retains immutable sample lineage and blocks publication", () => {
    expect(sampleLineage.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(sampleLineage.synthetic).toBe(true);
    expect(marketScores.every((score) => score.source.licenseReviewStatus === "pending")).toBe(true);
  });
});
