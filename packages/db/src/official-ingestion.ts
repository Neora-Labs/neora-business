import { randomUUID } from "node:crypto";
import { basename } from "node:path";

export const CIIU_4AC_2022 = "ciiu_4ac_2022" as const;
export type OfficialSourceKind = "emicron" | "ica";
export type ImportRequestStatus = "pending_review" | "approved" | "processing" | "completed" | "failed" | "blocked_mapping" | "rejected";
export type MappingStatus = "verified" | "unresolved" | "rejected";
export type EvidenceType = "observed" | "derived" | "expert" | "group_12";

export const OFFICIAL_SOURCES: Record<OfficialSourceKind, { name: string; organization: string; officialUrl: string; licenseName: string | null; latestObservationYear?: number }> = {
  emicron: {
    name: "EMICRON 2025", organization: "DANE / DIMPE",
    officialUrl: "https://microdatos.dane.gov.co/index.php/catalog/914/data-dictionary", licenseName: null
  },
  ica: {
    name: "Recaudo ICA Sector CIIU 2007–2023. Bogotá D.C.", organization: "Secretaría Distrital de Hacienda",
    officialUrl: "https://datosabiertos.bogota.gov.co/dataset/62be0dca-281d-4dee-b27e-c65153e9c9bf/resource/b59cbca5-21d1-4854-98ed-be6bfd2b3a32/download/19.-recaudo_ica_sector_ciiu_2007_2023.csv",
    licenseName: "CC BY 4.0", latestObservationYear: 2023
  }
};

export interface ImportRequestInput {
  sourceKind: OfficialSourceKind;
  fileName: string;
  checksumSha256: string;
  byteSize: number;
  officialUrl: string;
  licenseName: string | null;
  period: string;
  datasetVersion: string;
  proposedBy: string;
  variableLabels: Record<string, string>;
}
export interface OfficialImportRequest extends ImportRequestInput {
  id: string; status: ImportRequestStatus; ciiuVersion: typeof CIIU_4AC_2022;
  rawKey: string; createdAt: string; reviewedBy: string | null; reviewedAt: string | null;
  reviewReason: string | null; claimedBy: string | null; evidenceType: EvidenceType;
}
export interface IcaMapping {
  sourceCode: string; sourceDescription: string; targetCiiuClass?: string | null;
  targetCiiuDivision?: string | null; mappingMethod?: string | null; evidenceUrl?: string | null;
  mappingStatus: MappingStatus; reviewedAt?: string | null;
}

function requireChecksum(checksum: string) {
  if (!/^[a-f0-9]{64}$/i.test(checksum)) throw new Error("checksumSha256 must be a SHA-256 hex digest");
}
function safeFileName(fileName: string) {
  if (fileName.includes("/") || fileName.includes("\\")) throw new Error("fileName must not contain a path");
  const leaf = basename(fileName).replace(/[^A-Za-z0-9._-]/g, "-");
  if (!leaf || leaf === "." || leaf === "..") throw new Error("fileName is invalid");
  return leaf;
}
export function rawObjectKey(checksumSha256: string, fileName: string) {
  requireChecksum(checksumSha256);
  return `raw/sha256/${checksumSha256.toLowerCase()}/${safeFileName(fileName)}`;
}
export function createPresignedUploadPlan(input: { checksumSha256: string; fileName: string }) {
  return { key: rawObjectKey(input.checksumSha256, input.fileName), method: "PUT" as const, immutable: true as const, requiredHeader: "If-None-Match: *" };
}

export interface OfficialIngestionRepository {
  create(input: ImportRequestInput): OfficialImportRequest;
  update(request: OfficialImportRequest): OfficialImportRequest;
  get(id: string): OfficialImportRequest | null;
  list(): OfficialImportRequest[];
  claimNext(workerId: string): OfficialImportRequest | null;
  saveMappings(requestId: string, mappings: IcaMapping[]): void;
  mappings(requestId: string): IcaMapping[];
}

export class InMemoryOfficialIngestionRepository implements OfficialIngestionRepository {
  #requests = new Map<string, OfficialImportRequest>();
  #mappings = new Map<string, IcaMapping[]>();
  create(input: ImportRequestInput) {
    requireChecksum(input.checksumSha256);
    if (!input.officialUrl.startsWith("https://")) throw new Error("officialUrl must be HTTPS");
    if (input.sourceKind === "emicron" && Object.entries(input.variableLabels).some(([key, value]) => /^P\d+$/i.test(key) && !value.trim())) throw new Error("EMICRON P variables require dictionary labels");
    const now = new Date().toISOString();
    const request: OfficialImportRequest = {
      ...input, id: randomUUID(), status: "pending_review", ciiuVersion: CIIU_4AC_2022,
      rawKey: rawObjectKey(input.checksumSha256, input.fileName), createdAt: now, reviewedBy: null,
      reviewedAt: null, reviewReason: null, claimedBy: null,
      evidenceType: input.sourceKind === "emicron" ? "group_12" : "observed"
    };
    this.#requests.set(request.id, request);
    return structuredClone(request);
  }
  update(request: OfficialImportRequest) { this.#requests.set(request.id, structuredClone(request)); return structuredClone(request); }
  get(id: string) { const item = this.#requests.get(id); return item ? structuredClone(item) : null; }
  list() { return [...this.#requests.values()].map((item) => structuredClone(item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  claimNext(workerId: string) {
    const candidate = [...this.#requests.values()].find((item) => item.status === "approved");
    if (!candidate) return null;
    candidate.status = "processing"; candidate.claimedBy = workerId; this.#requests.set(candidate.id, candidate);
    return structuredClone(candidate);
  }
  saveMappings(requestId: string, mappings: IcaMapping[]) { this.#mappings.set(requestId, structuredClone(mappings)); }
  mappings(requestId: string) { return structuredClone(this.#mappings.get(requestId) ?? []); }
  completeIca(requestId: string, records: Array<{ sourceCode: string; sourceDescription: string }>) {
    const request = this.#requests.get(requestId); if (!request) throw new Error("Import request not found");
    const mappings: IcaMapping[] = records.map((record) => ({ ...record, targetCiiuDivision: null, mappingStatus: "unresolved" }));
    this.saveMappings(requestId, mappings);
    request.status = mappings.some((mapping) => mapping.mappingStatus !== "verified") ? "blocked_mapping" : "completed";
    this.#requests.set(requestId, request); return structuredClone(request);
  }
}

export function requestSourceImport(repository: OfficialIngestionRepository, input: ImportRequestInput) { return repository.create(input); }
export function reviewSourceImport(repository: OfficialIngestionRepository, id: string, input: { reviewerId: string; decision: "approved" | "rejected"; reason?: string }) {
  const request = repository.get(id); if (!request) throw new Error("Import request not found");
  if (request.proposedBy === input.reviewerId) throw new Error("A different authorized identity must review this import");
  if (request.status !== "pending_review") throw new Error("Only pending imports can be reviewed");
  request.status = input.decision === "approved" ? "approved" : "rejected";
  request.reviewedBy = input.reviewerId; request.reviewedAt = new Date().toISOString(); request.reviewReason = input.reason ?? null;
  return repository.update(request);
}

export function validateEmicronVariableLabels(variableKeys: string[], labels: Record<string, string>) {
  const missing = variableKeys.filter((key) => /^P\d+$/i.test(key) && !labels[key]?.trim());
  if (missing.length) throw new Error(`EMICRON variables require dictionary labels: ${missing.join(", ")}`);
}
export function canProduceDivisionMetric(input: { sourceKind: OfficialSourceKind; evidenceType: EvidenceType; mappingStatus?: MappingStatus }) {
  if (input.sourceKind === "emicron") return false;
  return input.mappingStatus === "verified";
}

