import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AppRole } from "./policies";
import type { CompanyProspect, ImportRunQuery, ImportRunRecord, MarketScoreQuery, OpportunityImportBundle, OpportunityRepository, PersistResult, ProspectImportBundle, ProspectImportResult, ProspectListQuery, ProspectListResult, ProspectSummary } from "./persistence";

type SqlRow = Record<string, unknown>;

export class PostgresOpportunityRepository implements OpportunityRepository {
  readonly #client: ReturnType<typeof postgres>;
  readonly #db: ReturnType<typeof drizzle>;
  constructor(databaseUrl: string) { this.#client = postgres(databaseUrl, { max: 5 }); this.#db = drizzle(this.#client); }

  async close() { await this.#client.end(); }

  async findRoleByClerkUserId(clerkUserId: string): Promise<AppRole | null> {
    const result = await this.#db.execute<SqlRow>(sql`SELECT role FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`);
    return (result[0]?.role as AppRole | undefined) ?? null;
  }

  async findPreferredLocaleByClerkUserId(clerkUserId: string): Promise<"es" | "en" | null> {
    const result = await this.#db.execute<SqlRow>(sql`SELECT preferred_locale FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`);
    const locale = result[0]?.preferred_locale; return locale === "es" || locale === "en" ? locale : null;
  }

  async updatePreferredLocaleByClerkUserId(clerkUserId: string, locale: "es" | "en"): Promise<void> {
    await this.#db.execute(sql`UPDATE users SET preferred_locale = ${locale} WHERE clerk_user_id = ${clerkUserId}`);
  }

  async persistImport(bundle: OpportunityImportBundle): Promise<PersistResult> {
    return this.#db.transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO data_sources (id,name,organization,official_url,country_code,license_name,license_review_status,is_synthetic)
        VALUES (${bundle.source.id}::uuid,${bundle.source.name},${bundle.source.organization},${bundle.source.officialUrl},${bundle.source.countryCode},${bundle.source.licenseName},${bundle.source.licenseReviewStatus}::license_review_status,${bundle.source.isSynthetic})
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, organization=EXCLUDED.organization, official_url=EXCLUDED.official_url,
        license_name=EXCLUDED.license_name, license_review_status=EXCLUDED.license_review_status, is_synthetic=EXCLUDED.is_synthetic`);
      const inserted = await tx.execute<SqlRow>(sql`INSERT INTO dataset_versions (id,source_id,period,checksum_sha256,downloaded_at,schema_version,raw_uri,byte_size,is_synthetic)
        VALUES (${bundle.dataset.id}::uuid,${bundle.source.id}::uuid,${bundle.dataset.period},${bundle.dataset.checksumSha256},${bundle.dataset.downloadedAt}::timestamptz,${bundle.dataset.schemaVersion},${bundle.dataset.rawUri},${bundle.dataset.byteSize},${bundle.source.isSynthetic})
        ON CONFLICT (source_id,checksum_sha256) DO NOTHING RETURNING id`);
      const duplicate = inserted.length === 0;
      const existing = duplicate ? await tx.execute<SqlRow>(sql`SELECT id FROM dataset_versions WHERE source_id=${bundle.source.id}::uuid AND checksum_sha256=${bundle.dataset.checksumSha256}`) : inserted;
      const datasetVersionId = String(existing[0]?.id);
      // The caller normally supplies a fresh run id, but retries may replay the
      // exact same bundle.  Keep the duplicate run visible without allowing a
      // primary-key collision to turn an idempotent dataset retry into a
      // failure.  The generated UUID is intentionally opaque: only the
      // dataset/checksum identity is deterministic.
      const insertedRun = await tx.execute<SqlRow>(sql`INSERT INTO import_runs (id,dataset_version_id,status,code_version,finished_at,rows_read,rows_accepted,rows_rejected,errors)
        VALUES (${bundle.importRun.id}::uuid,${datasetVersionId}::uuid,${duplicate ? "duplicate" : "completed"}::import_status,${bundle.importRun.codeVersion},now(),${bundle.importRun.rowsRead},${duplicate ? 0 : bundle.importRun.rowsAccepted},${bundle.importRun.rowsRejected},'[]'::jsonb)
        ON CONFLICT (id) DO NOTHING RETURNING id`);
      let importRunId = bundle.importRun.id;
      if (insertedRun.length === 0) {
        const retryRun = await tx.execute<SqlRow>(sql`INSERT INTO import_runs (id,dataset_version_id,status,code_version,finished_at,rows_read,rows_accepted,rows_rejected,errors)
          VALUES (gen_random_uuid(),${datasetVersionId}::uuid,'duplicate'::import_status,${bundle.importRun.codeVersion},now(),${bundle.importRun.rowsRead},0,${bundle.importRun.rowsRejected},'[]'::jsonb)
          RETURNING id`);
        importRunId = String(retryRun[0]?.id);
      }
      if (duplicate) return { datasetVersionId, importRunId, duplicate };

      await tx.execute(sql`INSERT INTO score_model_versions (kind,version,weights,minimum_coverage,active)
        VALUES (${bundle.models.opportunity.kind},${bundle.models.opportunity.version},${JSON.stringify(bundle.models.opportunity.weights)}::jsonb,${bundle.models.opportunity.minimumCoverage},true),
               (${bundle.models.confidence.kind},${bundle.models.confidence.version},${JSON.stringify(bundle.models.confidence.weights)}::jsonb,${bundle.models.confidence.minimumCoverage},true)
        ON CONFLICT (kind,version) DO UPDATE SET weights=EXCLUDED.weights, minimum_coverage=EXCLUDED.minimum_coverage`);
      const models = await tx.execute<SqlRow>(sql`SELECT id,kind FROM score_model_versions WHERE (kind=${bundle.models.opportunity.kind} AND version=${bundle.models.opportunity.version}) OR (kind=${bundle.models.confidence.kind} AND version=${bundle.models.confidence.version})`);
      const opportunityModelId = String(models.find((row) => row.kind === "sector")?.id);
      const confidenceModelId = String(models.find((row) => row.kind === "confidence")?.id);

      for (const score of bundle.scores) {
        const officialCode = `CO-${score.city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "-")}`;
        await tx.execute(sql`INSERT INTO geographies (country_code,city,official_code) VALUES ('CO',${score.city},${officialCode}) ON CONFLICT (country_code,official_code) DO NOTHING`);
        const geography = await tx.execute<SqlRow>(sql`SELECT id FROM geographies WHERE country_code='CO' AND official_code=${officialCode}`);
        const geographyId = String(geography[0]?.id);
        const metric = bundle.metrics.find((item) => item.city === score.city && item.sectorCode === score.sectorCode);
        if (metric) await tx.execute(sql`INSERT INTO sector_metrics (id,dataset_version_id,geography_id,sector_code,sector_name,period,values)
          VALUES (${metric.id}::uuid,${datasetVersionId}::uuid,${geographyId}::uuid,${metric.sectorCode},${metric.sectorName},${metric.period},${JSON.stringify(metric.values)}::jsonb)`);
        await tx.execute(sql`INSERT INTO sector_scores (id,geography_id,sector_code,sector_name,period,model_version_id,confidence_model_version_id,dataset_version_id,status,opportunity_score,confidence_score,score_payload)
          VALUES (${score.id}::uuid,${geographyId}::uuid,${score.sectorCode},${score.sector},${score.period},${opportunityModelId}::uuid,${confidenceModelId}::uuid,${datasetVersionId}::uuid,${score.status}::score_status,${score.score},${score.confidence},${JSON.stringify(score)}::jsonb)`);
        for (const factor of score.factors as Array<Record<string, unknown>>) await tx.execute(sql`INSERT INTO sector_score_factors (sector_score_id,factor_key,raw_value,normalized_value,weight,contribution,transformation,evidence_uri,observed_at)
          VALUES (${score.id}::uuid,${String(factor.key)},${factor.value as number | null},${factor.value as number | null},${Number(factor.weight)},${factor.contribution as number | null},'identity',${String(factor.evidenceId)},now())`);
        for (const factor of score.confidenceFactors as Array<Record<string, unknown>>) await tx.execute(sql`INSERT INTO confidence_score_factors (sector_score_id,factor_key,normalized_value,weight,contribution,evidence_uri,observed_at)
          VALUES (${score.id}::uuid,${String(factor.key)},${factor.value as number | null},${Number(factor.weight)},${factor.contribution as number | null},${String(factor.evidenceId)},now())`);
        for (const evidence of score.evidence as Array<Record<string, unknown>>) await tx.execute(sql`INSERT INTO evidence_records (id,sector_score_id,title,source_name,source_uri,observed_at,license_review_status)
          VALUES (${String(evidence.id)},${score.id}::uuid,${String(evidence.title)},${String(evidence.sourceName)},${String(evidence.sourceUri)},${String(evidence.observedAt)}::timestamptz,${String(evidence.licenseReviewStatus)}::license_review_status)`);
      }
      const actor = await tx.execute<SqlRow>(sql`SELECT id FROM users WHERE clerk_user_id=${bundle.audit.actorId} LIMIT 1`);
      await tx.execute(sql`INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,metadata,occurred_at)
        VALUES (${bundle.audit.id}::uuid,${actor[0]?.id ? String(actor[0].id) : null}::uuid,${bundle.audit.action},'dataset_version',${datasetVersionId},${JSON.stringify({ checksum: bundle.dataset.checksumSha256 })}::jsonb,${bundle.audit.occurredAt}::timestamptz)`);
      return { datasetVersionId, importRunId, duplicate };
    });
  }

  async listMarketScores({ researchMode }: MarketScoreQuery): Promise<OpportunityImportBundle["scores"]> {
    const result = await this.#db.execute<SqlRow>(sql`SELECT ss.score_payload FROM sector_scores ss JOIN dataset_versions dv ON dv.id=ss.dataset_version_id JOIN data_sources ds ON ds.id=dv.source_id
      WHERE ds.license_review_status='approved' OR (${researchMode} AND ds.is_synthetic=true) ORDER BY ss.opportunity_score DESC NULLS LAST`);
    return result.map((row) => row.score_payload as OpportunityImportBundle["scores"][number]);
  }

  async listImportRuns({ limit = 20 }: ImportRunQuery = {}): Promise<ImportRunRecord[]> {
    const boundedLimit = Math.min(100, Math.max(0, limit));
    const result = await this.#db.execute<SqlRow>(sql`SELECT id,dataset_version_id,status,code_version,rows_read,rows_accepted,rows_rejected,finished_at
      FROM import_runs ORDER BY started_at DESC LIMIT ${boundedLimit}`);
    return result.map((row) => ({
      id: String(row.id), datasetVersionId: String(row.dataset_version_id), status: row.status as ImportRunRecord["status"],
      codeVersion: String(row.code_version), rowsRead: Number(row.rows_read), rowsAccepted: Number(row.rows_accepted),
      rowsRejected: Number(row.rows_rejected), finishedAt: new Date(String(row.finished_at)).toISOString()
    }));
  }

  async persistProspectImport(bundle: ProspectImportBundle): Promise<ProspectImportResult> {
    return this.#db.transaction(async (tx) => {
      const actor = await tx.execute<SqlRow>(sql`SELECT id FROM users WHERE clerk_user_id=${bundle.import.importedBy} LIMIT 1`);
      if (!actor[0]?.id) throw new Error("Prospect importer is not an authorized application user");
      const inserted = await tx.execute<SqlRow>(sql`INSERT INTO prospect_imports (file_name,checksum_sha256,imported_by,imported_at,rows_read,rows_accepted,errors)
        VALUES (${bundle.import.fileName},${bundle.import.checksumSha256},${String(actor[0].id)}::uuid,${bundle.import.importedAt}::timestamptz,${bundle.prospects.length},${bundle.prospects.length},${JSON.stringify(bundle.import.errors ?? [])}::jsonb)
        ON CONFLICT (checksum_sha256) DO NOTHING RETURNING id`);
      if (!inserted[0]?.id) {
        const existing = await tx.execute<SqlRow>(sql`SELECT id FROM prospect_imports WHERE checksum_sha256=${bundle.import.checksumSha256}`);
        return { importId: String(existing[0]?.id), duplicate: true, importedCount: 0 };
      }
      const importId = String(inserted[0].id); const ids = new Set<string>();
      for (const item of bundle.prospects) {
        if (item.geography !== "Bogotá") throw new Error("Company prospects are limited to Bogotá");
        if (ids.has(item.externalId)) throw new Error("Duplicate prospect external ID"); ids.add(item.externalId);
        await tx.execute(sql`INSERT INTO company_prospects (prospect_import_id,external_id,company_name,sector,geography,public_url,fit_signal,initial_proposal,priority,outreach_status,decision_maker_role)
          VALUES (${importId}::uuid,${item.externalId},${item.companyName},${item.sector},${item.geography},${item.publicUrl},${item.fitSignal},${item.initialProposal},${item.priority}::prospect_priority,${item.outreachStatus},${item.decisionMakerRole})`);
      }
      await tx.execute(sql`INSERT INTO audit_events (actor_id,action,entity_type,entity_id,metadata)
        VALUES (${String(actor[0].id)}::uuid,'prospect_imported','prospect_import',${importId},${JSON.stringify({ checksum: bundle.import.checksumSha256, count: bundle.prospects.length })}::jsonb)`);
      return { importId, duplicate: false, importedCount: bundle.prospects.length };
    });
  }

  async listProspects(query: ProspectListQuery): Promise<ProspectListResult> {
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25)); const page = Math.max(1, query.page ?? 1);
    const result = await this.#db.execute<SqlRow>(sql`SELECT id,prospect_import_id,external_id,company_name,sector,geography,public_url,fit_signal,initial_proposal,priority,outreach_status,decision_maker_role,created_at,updated_at,
      count(*) OVER() AS total FROM company_prospects WHERE (${query.sector ?? null}::text IS NULL OR sector=${query.sector ?? null}) AND (${query.outreachStatus ?? null}::text IS NULL OR outreach_status=${query.outreachStatus ?? null}) AND (${query.priority ?? null}::text IS NULL OR priority=${query.priority ?? null}::prospect_priority)
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
    const data = result.map((row) => prospectRow(row)); return { data, total: Number(result[0]?.total ?? 0), page, pageSize };
  }

  async summarizeProspects(): Promise<ProspectSummary> {
    const [sectors, statuses, total] = await Promise.all([
      this.#db.execute<SqlRow>(sql`SELECT sector AS key,count(*) AS count FROM company_prospects GROUP BY sector ORDER BY sector`),
      this.#db.execute<SqlRow>(sql`SELECT outreach_status AS key,count(*) AS count FROM company_prospects GROUP BY outreach_status ORDER BY outreach_status`),
      this.#db.execute<SqlRow>(sql`SELECT count(*) AS total,count(*) FILTER (WHERE geography='Bogotá') AS bogota_count FROM company_prospects`),
    ]);
    return { total: Number(total[0]?.total ?? 0), bogotaCount: Number(total[0]?.bogota_count ?? 0), bySector: sectors.map(countRow), byStatus: statuses.map(countRow) };
  }

  async updateProspect(id: string, patch: Pick<CompanyProspect, "priority" | "outreachStatus">): Promise<CompanyProspect | null> {
    const result = await this.#db.execute<SqlRow>(sql`UPDATE company_prospects SET priority=${patch.priority}::prospect_priority,outreach_status=${patch.outreachStatus},updated_at=now() WHERE id=${id}::uuid
      RETURNING id,prospect_import_id,external_id,company_name,sector,geography,public_url,fit_signal,initial_proposal,priority,outreach_status,decision_maker_role,created_at,updated_at`);
    return result[0] ? prospectRow(result[0]) : null;
  }
}

function countRow(row: SqlRow) { return { key: String(row.key), count: Number(row.count) }; }
function prospectRow(row: SqlRow): CompanyProspect {
  return { id: String(row.id), prospectImportId: String(row.prospect_import_id), externalId: String(row.external_id), companyName: String(row.company_name), sector: String(row.sector), geography: "Bogotá", publicUrl: String(row.public_url), fitSignal: String(row.fit_signal), initialProposal: String(row.initial_proposal), priority: row.priority as CompanyProspect["priority"], outreachStatus: String(row.outreach_status), decisionMakerRole: String(row.decision_maker_role), createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString() };
}
