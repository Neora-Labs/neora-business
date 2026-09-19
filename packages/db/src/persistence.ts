import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type LicenseStatus = "pending" | "approved" | "rejected";
export interface ScoreModelRegistration {
  kind: "sector" | "confidence";
  version: string;
  weights: Record<string, number>;
  minimumCoverage: number;
}
export interface OpportunityImportBundle {
  source: { id: string; name: string; organization: string; officialUrl: string | null; countryCode: string; licenseName: string | null; licenseReviewStatus: LicenseStatus; isSynthetic: boolean };
  dataset: { id: string; period: string; checksumSha256: string; downloadedAt: string; schemaVersion: string; rawUri: string; byteSize: number };
  importRun: { id: string; codeVersion: string; rowsRead: number; rowsAccepted: number; rowsRejected: number };
  models: { opportunity: ScoreModelRegistration; confidence: ScoreModelRegistration };
  metrics: Array<{ id: string; city: string; sectorCode: string; sectorName: string; period: string; values: Record<string, number | null> }>;
  scores: Array<{ id: string; city: string; sectorCode: string; sector: string; period: string; score: number | null; confidence: number | null; confidenceLabel: "high" | "medium" | "low" | "insufficient"; status: "scored" | "insufficient_data" | "excluded" | "pending_validation" | "rejected"; modelVersion: string; confidenceModelVersion: string; factors: unknown[]; confidenceFactors: unknown[]; source: { name: string; url: string | null; observedAt: string; licenseReviewStatus: LicenseStatus }; evidence: unknown[] }>;
  audit: { id: string; actorId: string; action: string; occurredAt: string };
}
export interface PersistResult { datasetVersionId: string; importRunId: string; duplicate: boolean }
export interface MarketScoreQuery { researchMode: boolean }
export interface ImportRunQuery { limit?: number }
export type ImportRunRecord = OpportunityImportBundle["importRun"] & {
  datasetVersionId: string;
  status: "completed" | "duplicate";
  finishedAt: string;
};
export type ProspectPriority = "A" | "B" | "C";
export interface ProspectInput { externalId: string; companyName: string; sector: string; geography: "Bogotá"; publicUrl: string; fitSignal: string; initialProposal: string; priority: ProspectPriority; outreachStatus: string; decisionMakerRole: string }
export interface ProspectImportBundle { import: { fileName: string; checksumSha256: string; importedBy: string; importedAt: string; errors?: string[] }; prospects: ProspectInput[] }
export interface CompanyProspect extends ProspectInput { id: string; prospectImportId: string; createdAt: string; updatedAt: string }
export interface ProspectListQuery { page?: number; pageSize?: number; sector?: string; outreachStatus?: string; priority?: ProspectPriority }
export interface ProspectListResult { data: CompanyProspect[]; total: number; page: number; pageSize: number }
export interface ProspectSummary { total: number; bySector: Array<{ key: string; count: number }>; byStatus: Array<{ key: string; count: number }>; bogotaCount: number }
export interface ProspectImportResult { importId: string; duplicate: boolean; importedCount: number }
export interface OpportunityRepository {
  persistImport(bundle: OpportunityImportBundle): Promise<PersistResult>;
  listMarketScores(query: MarketScoreQuery): Promise<OpportunityImportBundle["scores"]>;
  listImportRuns(query?: ImportRunQuery): Promise<ImportRunRecord[]>;
  findRoleByClerkUserId(clerkUserId: string): Promise<import("./policies").AppRole | null>;
  findPreferredLocaleByClerkUserId(clerkUserId: string): Promise<"es" | "en" | null>;
  updatePreferredLocaleByClerkUserId(clerkUserId: string, locale: "es" | "en"): Promise<void>;
  persistProspectImport(bundle: ProspectImportBundle): Promise<ProspectImportResult>;
  listProspects(query: ProspectListQuery): Promise<ProspectListResult>;
  summarizeProspects(): Promise<ProspectSummary>;
  updateProspect(id: string, patch: Pick<ProspectInput, "priority" | "outreachStatus">): Promise<CompanyProspect | null>;
}

interface LocalState {
  sources: OpportunityImportBundle["source"][];
  datasetVersions: OpportunityImportBundle["dataset"][];
  importRuns: ImportRunRecord[];
  modelVersions: ScoreModelRegistration[];
  metrics: OpportunityImportBundle["metrics"];
  scores: Array<OpportunityImportBundle["scores"][number] & { sourceId: string; datasetVersionId: string }>;
  auditEvents: OpportunityImportBundle["audit"][];
  users: Array<{ clerkUserId: string; role: import("./policies").AppRole; preferredLocale?: "es" | "en" }>;
  prospectImports: Array<{ id: string; fileName: string; checksumSha256: string; importedBy: string; importedAt: string; rowsRead: number; rowsAccepted: number; errors: string[] }>;
  prospects: CompanyProspect[];
}
const EMPTY: LocalState = { sources: [], datasetVersions: [], importRuns: [], modelVersions: [], metrics: [], scores: [], auditEvents: [], users: [], prospectImports: [], prospects: [] };

export class LocalFileOpportunityRepository implements OpportunityRepository {
  constructor(private readonly path: string) {}
  private async read(): Promise<LocalState> {
    try {
      const state = JSON.parse(await readFile(this.path, "utf8")) as LocalState;
      return { ...structuredClone(EMPTY), ...state };
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY); throw error; }
  }
  private async write(state: LocalState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporary, this.path);
  }
  async persistImport(bundle: OpportunityImportBundle): Promise<PersistResult> {
    const state = await this.read();
    const existingDataset = state.datasetVersions.find((item) => item.checksumSha256 === bundle.dataset.checksumSha256 && state.sources.some((source) => source.id === bundle.source.id));
    const duplicate = Boolean(existingDataset);
    const datasetVersionId = existingDataset?.id ?? bundle.dataset.id;
    const sourceIndex = state.sources.findIndex((source) => source.id === bundle.source.id);
    if (sourceIndex >= 0) state.sources[sourceIndex] = bundle.source; else state.sources.push(bundle.source);
    if (!duplicate) {
      state.datasetVersions.push(bundle.dataset);
      for (const model of [bundle.models.opportunity, bundle.models.confidence]) {
        const existingModel = state.modelVersions.findIndex((item) => item.kind === model.kind && item.version === model.version);
        if (existingModel >= 0) state.modelVersions[existingModel] = model; else state.modelVersions.push(model);
      }
      state.metrics.push(...bundle.metrics);
      state.scores.push(...bundle.scores.map((score) => ({ ...score, sourceId: bundle.source.id, datasetVersionId })));
      state.auditEvents.push(bundle.audit);
    }
    const importRunId = duplicate ? `${bundle.importRun.id}-duplicate-${state.importRuns.length + 1}` : bundle.importRun.id;
    state.importRuns.push({ ...bundle.importRun, id: importRunId, datasetVersionId, status: duplicate ? "duplicate" : "completed", finishedAt: bundle.audit.occurredAt });
    await this.write(state);
    return { datasetVersionId, importRunId, duplicate };
  }
  async listMarketScores({ researchMode }: MarketScoreQuery): Promise<OpportunityImportBundle["scores"]> {
    const state = await this.read();
    return state.scores.filter((score) => {
      const source = state.sources.find((item) => item.id === score.sourceId);
      return source?.licenseReviewStatus === "approved" || (researchMode && source?.isSynthetic === true);
    }).map(({ sourceId: _sourceId, datasetVersionId: _datasetVersionId, ...score }) => score);
  }
  async findRoleByClerkUserId(clerkUserId: string) {
    return (await this.read()).users.find((user) => user.clerkUserId === clerkUserId)?.role ?? null;
  }
  async findPreferredLocaleByClerkUserId(clerkUserId: string): Promise<"es" | "en" | null> { return (await this.read()).users.find((user) => user.clerkUserId === clerkUserId)?.preferredLocale ?? null; }
  async updatePreferredLocaleByClerkUserId(clerkUserId: string, locale: "es" | "en"): Promise<void> {
    const state = await this.read(); const user = state.users.find((item) => item.clerkUserId === clerkUserId);
    if (user) { user.preferredLocale = locale; await this.write(state); }
  }
  async listImportRuns({ limit = 20 }: ImportRunQuery = {}): Promise<ImportRunRecord[]> {
    const state = await this.read();
    return state.importRuns.slice().reverse().slice(0, Math.max(0, limit));
  }
  async persistProspectImport(bundle: ProspectImportBundle): Promise<ProspectImportResult> {
    const state = await this.read(); const existing = state.prospectImports.find((item) => item.checksumSha256 === bundle.import.checksumSha256);
    if (existing) return { importId: existing.id, duplicate: true, importedCount: 0 };
    const ids = new Set<string>(); for (const item of bundle.prospects) { if (item.geography !== "Bogotá") throw new Error("Company prospects are limited to Bogotá"); if (ids.has(item.externalId)) throw new Error("Duplicate prospect external ID"); ids.add(item.externalId); }
    const importId = randomUUID(); const now = bundle.import.importedAt;
    state.prospectImports.push({ id: importId, ...bundle.import, rowsRead: bundle.prospects.length, rowsAccepted: bundle.prospects.length, errors: bundle.import.errors ?? [] });
    state.prospects.push(...bundle.prospects.map((item) => ({ id: randomUUID(), prospectImportId: importId, ...item, createdAt: now, updatedAt: now })));
    await this.write(state); return { importId, duplicate: false, importedCount: bundle.prospects.length };
  }
  async listProspects(query: ProspectListQuery): Promise<ProspectListResult> {
    const state = await this.read(); const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25)); const page = Math.max(1, query.page ?? 1);
    const filtered = state.prospects.filter((item) => (!query.sector || item.sector === query.sector) && (!query.outreachStatus || item.outreachStatus === query.outreachStatus) && (!query.priority || item.priority === query.priority));
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
  }
  async summarizeProspects(): Promise<ProspectSummary> { return summarizeProspects((await this.read()).prospects); }
  async updateProspect(id: string, patch: Pick<ProspectInput, "priority" | "outreachStatus">): Promise<CompanyProspect | null> {
    const state = await this.read(); const item = state.prospects.find((prospect) => prospect.id === id); if (!item) return null;
    item.priority = patch.priority; item.outreachStatus = patch.outreachStatus; item.updatedAt = new Date().toISOString(); await this.write(state); return item;
  }
}

export function summarizeProspects(prospects: ProspectInput[]): ProspectSummary {
  const count = (values: string[]) => Array.from(values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>()).entries()).map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key));
  return { total: prospects.length, bySector: count(prospects.map((item) => item.sector)), byStatus: count(prospects.map((item) => item.outreachStatus)), bogotaCount: prospects.filter((item) => item.geography === "Bogotá").length };
}
