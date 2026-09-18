import { z } from "zod";

export const citySchema = z.enum(["Bogotá", "Medellín", "Cali"]);
export const factorSchema = z.object({
  key: z.string(), label: z.string(), value: z.number().min(0).max(1).nullable(),
  weight: z.number().positive(), contribution: z.number().nullable(), evidenceId: z.string()
});
export const sectorScoreSchema = z.object({
  id: z.string(), city: citySchema, sectorCode: z.string(), sector: z.string(), period: z.string(),
  score: z.number().min(0).max(100).nullable(), confidence: z.number().min(0).max(100),
  confidenceLabel: z.enum(["high", "medium", "low", "insufficient"]),
  status: z.enum(["scored", "insufficient_data"]), modelVersion: z.string(),
  confidenceModelVersion: z.string(), confidenceFactors: z.array(factorSchema),
  source: z.object({ name: z.string(), url: z.string().url().nullable(), observedAt: z.string(), licenseReviewStatus: z.enum(["pending", "approved", "rejected"]) }),
  factors: z.array(factorSchema),
  evidence: z.array(z.object({ id: z.string(), title: z.string(), observedAt: z.string(), sourceName: z.string(), sourceUri: z.string(), licenseReviewStatus: z.enum(["pending", "approved", "rejected"]) }))
});
export type SectorScoreContract = z.infer<typeof sectorScoreSchema>;

export interface DatasetDescriptor { id: string; period: string; isSynthetic: boolean }
export interface RawAsset { path: string; checksum: string; bytes: number }
export interface QualityReport { passed: boolean; issues: string[] }
export interface NormalizedBatch { rows: unknown[]; checksum: string }
export interface LoadResult { datasetVersionId: string; duplicate: boolean }
export interface SourceConnector {
  discover(): Promise<DatasetDescriptor[]>;
  acquire(dataset: DatasetDescriptor): Promise<RawAsset[]>;
  validateRaw(asset: RawAsset): Promise<QualityReport>;
  normalize(asset: RawAsset): Promise<NormalizedBatch>;
  load(batch: NormalizedBatch): Promise<LoadResult>;
}
