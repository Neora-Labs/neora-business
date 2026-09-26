import { describe, expect, it } from "vitest";
import { calculateConfidence, calculateScore, confidenceLabel, CONFIDENCE_MODEL_V1, SECTOR_MODEL_V1, SECTOR_MODEL_V2 } from "../src/index";

describe("deterministic scoring", () => {
  it("returns the exact same unrounded result for identical input and version", () => {
    const factors = SECTOR_MODEL_V1.factors.map((factor, index) => ({ ...factor, value: (index + 2) / 10, evidenceId: `ev-${index}` }));
    expect(calculateScore(SECTOR_MODEL_V1, factors)).toEqual(calculateScore(SECTOR_MODEL_V1, factors));
  });

  it("keeps missing values null and renormalizes only when coverage is at least 65%", () => {
    const factors = SECTOR_MODEL_V1.factors.map((factor) => ({ ...factor, value: factor.key === "accessibility" ? null : 0.5, evidenceId: "ev" }));
    const result = calculateScore(SECTOR_MODEL_V1, factors);
    expect(result.status).toBe("scored");
    expect(result.factors.find((factor) => factor.key === "accessibility")?.value).toBeNull();
    expect(result.score).toBe(50);
  });

  it("returns insufficient_data below 65% coverage instead of treating null as zero", () => {
    const factors = SECTOR_MODEL_V1.factors.map((factor, index) => ({ ...factor, value: index < 3 ? 0.8 : null, evidenceId: "ev" }));
    const result = calculateScore(SECTOR_MODEL_V1, factors);
    expect(result.coverage).toBe(55);
    expect(result.status).toBe("insufficient_data");
    expect(result.score).toBeNull();
  });

  it.each([[80, "high"], [60, "medium"], [40, "low"], [39.99, "insufficient"]] as const)("labels confidence %s as %s", (score, label) => {
    expect(confidenceLabel(score)).toBe(label);
  });
});

describe("versioned confidence scoring", () => {
  it("calculates confidence from five evidence-quality factors instead of accepting a supplied score", () => {
    const result = calculateConfidence({ authority: 0.9, completeness: 0.8, freshness: 0.7, consistency: 0.6, entity_resolution: 1 });
    expect(result.modelId).toBe(CONFIDENCE_MODEL_V1.id);
    expect(result.score).toBe(80);
    expect(result.factors).toHaveLength(5);
    expect(result.factors.reduce((sum, factor) => sum + (factor.contribution ?? 0), 0)).toBe(80);
  });
});

describe("Bogotá pilot scoring model v2", () => {
  it("calculates score with 65% coverage from fiscal factors and renormalizes correctly", () => {
    // market_size (25) + dynamism (20) + economic_capacity (20) = 65% >= 60%
    const factors = SECTOR_MODEL_V2.factors.map((factor) => {
      if (factor.key === "digital_gap" || factor.key === "automation_potential") {
        return { ...factor, value: null, evidenceId: `ev-${factor.key}` };
      }
      return { ...factor, value: 0.6, evidenceId: `ev-${factor.key}` };
    });
    const result = calculateScore(SECTOR_MODEL_V2, factors);
    expect(result.modelId).toBe("sector-opportunity-bogota-v2");
    expect(result.status).toBe("scored");
    expect(result.coverage).toBe(65);
    expect(result.score).toBe(60);
    expect(result.factors.find((f) => f.key === "digital_gap")?.value).toBeNull();
  });

  it("returns insufficient_data when coverage is below 60%", () => {
    // Only market_size (25) + dynamism (20) = 45% < 60%
    const factors = SECTOR_MODEL_V2.factors.map((factor) => {
      const isPresent = factor.key === "market_size" || factor.key === "dynamism";
      return { ...factor, value: isPresent ? 0.7 : null, evidenceId: `ev-${factor.key}` };
    });
    const result = calculateScore(SECTOR_MODEL_V2, factors);
    expect(result.status).toBe("insufficient_data");
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(45);
  });
});

