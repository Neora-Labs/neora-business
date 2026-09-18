import { sectorScoreSchema, type SectorScoreContract } from "@neora/contracts";
import generated from "../data/market-scores.generated.json";

export const marketScores: SectorScoreContract[] = generated.scores.map((score) => sectorScoreSchema.parse(score));
export const pilotCities = ["Bogotá", "Medellín", "Cali"] as const;
export const sampleLineage = { generatedFrom: generated.generatedFrom, checksumSha256: generated.checksumSha256, synthetic: generated.synthetic };
