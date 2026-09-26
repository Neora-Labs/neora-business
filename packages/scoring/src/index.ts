export type ScoreStatus = "scored" | "insufficient_data";

export interface FactorDefinition {
  key: string;
  label: string;
  weight: number;
}

export interface ScoreModel {
  id: string;
  name: string;
  version: string;
  minimumCoverage: number;
  factors: readonly FactorDefinition[];
}

export interface FactorInput extends FactorDefinition {
  value: number | null;
  evidenceId: string;
}

export interface FactorResult extends FactorInput {
  contribution: number | null;
}

export interface ScoreResult {
  modelId: string;
  status: ScoreStatus;
  score: number | null;
  coverage: number;
  factors: FactorResult[];
}

export const SECTOR_MODEL_V1 = {
  id: "sector-opportunity-co-v1",
  name: "Colombia sector opportunity",
  version: "1.0.0",
  minimumCoverage: 65,
  factors: [
    { key: "digital_gap", label: "Brecha digital", weight: 20 },
    { key: "automation_potential", label: "Potencial de automatización", weight: 20 },
    { key: "economic_capacity", label: "Capacidad económica", weight: 15 },
    { key: "accessible_market", label: "Mercado accesible", weight: 15 },
    { key: "competitive_pressure", label: "Presión competitiva", weight: 10 },
    { key: "service_fit", label: "Encaje con Neora", weight: 10 },
    { key: "accessibility", label: "Acceso e identificación", weight: 10 }
  ]
} as const satisfies ScoreModel;

export const SECTOR_MODEL_V2 = {
  id: "sector-opportunity-bogota-v2",
  name: "Bogotá CIIU division opportunity",
  version: "2.0.0",
  minimumCoverage: 60,
  factors: [
    { key: "market_size", label: "Tamaño de mercado", weight: 25 },
    { key: "dynamism", label: "Dinamismo económico", weight: 20 },
    { key: "economic_capacity", label: "Capacidad económica", weight: 20 },
    { key: "digital_gap", label: "Brecha digital", weight: 20 },
    { key: "automation_potential", label: "Potencial de automatización", weight: 15 }
  ]
} as const satisfies ScoreModel;

export const CONFIDENCE_MODEL_V1 = {
  id: "evidence-confidence-v1",
  name: "Evidence confidence",
  version: "1.0.0",
  minimumCoverage: 100,
  factors: [
    { key: "authority", label: "Source authority & traceability", weight: 30 },
    { key: "completeness", label: "Required-variable completeness", weight: 25 },
    { key: "freshness", label: "Evidence freshness", weight: 20 },
    { key: "consistency", label: "Cross-source consistency", weight: 15 },
    { key: "entity_resolution", label: "Entity-resolution confidence", weight: 10 }
  ]
} as const satisfies ScoreModel;

export function calculateScore(model: ScoreModel, factors: readonly FactorInput[]): ScoreResult {
  const byKey = new Map(factors.map((factor) => [factor.key, factor]));
  const ordered = model.factors.map((definition) => {
    const input = byKey.get(definition.key);
    if (!input) throw new Error(`Missing factor definition: ${definition.key}`);
    if (input.value !== null && (input.value < 0 || input.value > 1)) {
      throw new RangeError(`${definition.key} must be null or between 0 and 1`);
    }
    return { ...definition, value: input.value, evidenceId: input.evidenceId, contribution: null };
  });
  const availableWeight = ordered.reduce((sum, factor) => sum + (factor.value === null ? 0 : factor.weight), 0);
  const totalWeight = model.factors.reduce((sum, factor) => sum + factor.weight, 0);
  // Canonicalize IEEE-754 noise, not business precision. UI rounding remains a presentation concern.
  const coverage = Number((((availableWeight / totalWeight) * 100)).toPrecision(15));
  const status: ScoreStatus = coverage >= model.minimumCoverage ? "scored" : "insufficient_data";
  const scoredFactors = ordered.map((factor) => ({
    ...factor,
    contribution: status === "scored" && factor.value !== null
      ? (100 * factor.value * factor.weight) / availableWeight
      : null
  }));
  const weightedValue = ordered.reduce((sum, factor) => sum + (factor.value === null ? 0 : factor.value * factor.weight), 0);
  const score = status === "scored"
    ? Number(((100 * weightedValue) / availableWeight).toPrecision(15))
    : null;
  return { modelId: model.id, status, score, coverage, factors: scoredFactors };
}

export type ConfidenceInputs = Record<(typeof CONFIDENCE_MODEL_V1.factors)[number]["key"], number | null>;
export function calculateConfidence(inputs: ConfidenceInputs): ScoreResult {
  return calculateScore(CONFIDENCE_MODEL_V1, CONFIDENCE_MODEL_V1.factors.map((factor) => ({
    ...factor, value: inputs[factor.key], evidenceId: `confidence:${factor.key}`
  })));
}

export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient";

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  if (score >= 40) return "low";
  return "insufficient";
}
