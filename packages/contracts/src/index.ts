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
  status: z.enum(["scored", "insufficient_data", "excluded", "pending_validation", "rejected"]), modelVersion: z.string(),
  confidenceModelVersion: z.string(), confidenceFactors: z.array(factorSchema),
  source: z.object({ name: z.string(), url: z.string().url().nullable(), observedAt: z.string(), licenseReviewStatus: z.enum(["pending", "approved", "rejected"]) }),
  factors: z.array(factorSchema),
  evidence: z.array(z.object({ id: z.string(), title: z.string(), observedAt: z.string(), sourceName: z.string(), sourceUri: z.string(), licenseReviewStatus: z.enum(["pending", "approved", "rejected"]) }))
});
export type SectorScoreContract = z.infer<typeof sectorScoreSchema>;

export const officialImportRequestSchema = z.object({
  sourceKind: z.enum(["emicron", "ica"]), fileName: z.string().min(1).max(255),
  checksumSha256: z.string().regex(/^[a-fA-F0-9]{64}$/), byteSize: z.number().int().nonnegative(),
  officialUrl: z.string().url().startsWith("https://"), licenseName: z.string().min(1).nullable(),
  period: z.string().min(1).max(100), datasetVersion: z.string().min(1).max(100),
  variableLabels: z.record(z.string(), z.string())
});
export type OfficialImportRequestContract = z.infer<typeof officialImportRequestSchema>;

export const prospectPrioritySchema = z.enum(["A", "B", "C"]);
export const decisionMakerRoleSchema = z.enum([
  "Alianzas / Producto", "Comercial / Transformación", "Dirección comercial", "Dirección comercial / Operaciones", "Dirección comercial / Tecnología", "Dirección comercial / e-commerce", "Dirección de franquicias", "Dirección de oficina", "Franquicias / Operaciones", "Fundadores / Alianzas", "Gerencia", "Gerencia / Comercial", "Gerencia / E-commerce", "Gerencia / Ingeniería", "Gerencia / Marketing", "Gerencia / Operaciones", "Gerencia / Proyectos", "Gerencia comercial", "Gerencia comercial / Operaciones", "Innovación / B2B", "Innovación / Comercial", "Innovación / Operaciones", "Marketing / Operaciones", "Operaciones / Marketing", "Operaciones / Producto", "Operaciones / Tecnología", "Propietario / Gerencia",
]);
const publicHttpUrlSchema = z.string().url().max(2048).refine((value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, { message: "Expected an http(s) URL" });
export const prospectInputSchema = z.object({
  externalId: z.string().trim().min(1).max(128), companyName: z.string().trim().min(1).max(300),
  sector: z.string().trim().min(1).max(200), fitSignal: z.string().trim().min(1).max(2000),
  initialProposal: z.string().trim().min(1).max(2000), publicUrl: publicHttpUrlSchema,
  priority: prospectPrioritySchema, outreachStatus: z.string().trim().min(1).max(100),
  decisionMakerRole: decisionMakerRoleSchema,
});
export type ProspectInputContract = z.infer<typeof prospectInputSchema>;

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
