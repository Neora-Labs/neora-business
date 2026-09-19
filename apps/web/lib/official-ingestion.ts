import { InMemoryOfficialIngestionRepository, OFFICIAL_SOURCES, S3PresignedRawUploadStore, createPresignedUploadPlan, type OfficialImportRequest } from "@neora/db";
import type { OfficialImportRequestContract } from "@neora/contracts";

const localQueue = new InMemoryOfficialIngestionRepository();
export function localOfficialQueue() { return localQueue; }
export function canonicalSource(input: OfficialImportRequestContract) {
  const source = OFFICIAL_SOURCES[input.sourceKind];
  if (input.officialUrl !== source.officialUrl || input.licenseName !== source.licenseName) throw new Error("Source metadata must match the registered official source");
  return source;
}
export async function createUploadPlan(input: Pick<OfficialImportRequestContract, "checksumSha256" | "fileName"> & { contentType: string }) {
  const bucket = process.env.RAW_ASSET_BUCKET;
  if (!bucket) return { ...createPresignedUploadPlan(input), uploadUrl: null, configurationError: "RAW_ASSET_BUCKET is not configured" };
  const store = new S3PresignedRawUploadStore(bucket, process.env.AWS_REGION ?? "sa-east-1", undefined, process.env.S3_ENDPOINT);
  return store.create({ checksum: input.checksumSha256, fileName: input.fileName, contentType: input.contentType });
}
export type PublicImportRequest = Pick<OfficialImportRequest, "id" | "sourceKind" | "fileName" | "period" | "datasetVersion" | "status" | "ciiuVersion" | "rawKey" | "createdAt" | "reviewedAt" | "reviewReason" | "evidenceType">;
export function publicRequest(request: OfficialImportRequest): PublicImportRequest {
  return {
    id: request.id, sourceKind: request.sourceKind, fileName: request.fileName, period: request.period,
    datasetVersion: request.datasetVersion, status: request.status, ciiuVersion: request.ciiuVersion,
    rawKey: request.rawKey, createdAt: request.createdAt, reviewedAt: request.reviewedAt,
    reviewReason: request.reviewReason, evidenceType: request.evidenceType
  };
}
