import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { CIIU_4AC_2022, type IcaMapping, type ImportRequestInput, type ImportRequestStatus, type OfficialImportRequest } from "./official-ingestion";

type Row = Record<string, unknown>;
function asRequest(row: Row): OfficialImportRequest {
  return {
    id: String(row.id), sourceKind: String(row.source_key) === "ica-2007-2023" ? "ica" : "emicron", fileName: String(row.file_name),
    checksumSha256: String(row.checksum_sha256), byteSize: Number(row.byte_size), officialUrl: String(row.official_url), licenseName: row.license_name ? String(row.license_name) : null,
    period: String(row.period), datasetVersion: String(row.dataset_version), proposedBy: String(row.proposed_by),
    variableLabels: (row.variable_labels as Record<string, string>) ?? {}, status: row.status as ImportRequestStatus,
    ciiuVersion: CIIU_4AC_2022, rawKey: String(row.raw_key), createdAt: new Date(String(row.created_at)).toISOString(),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null, reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : null,
    reviewReason: row.review_reason ? String(row.review_reason) : null, claimedBy: row.claimed_by ? String(row.claimed_by) : null,
    evidenceType: row.evidence_type as OfficialImportRequest["evidenceType"]
  };
}
/** PostgreSQL-backed queue. The worker claims rows atomically; it never runs in a Next.js request. */
export class PostgresOfficialIngestionQueue {
  readonly #client: ReturnType<typeof postgres>;
  readonly #db: ReturnType<typeof drizzle>;
  constructor(url: string) { this.#client = postgres(url, { max: 3 }); this.#db = drizzle(this.#client); }
  async close() { await this.#client.end(); }
  async list(): Promise<OfficialImportRequest[]> {
    const rows = await this.#db.execute<Row>(sql`SELECT request.*,source.source_key,source.official_url,source.license_name
      FROM official_import_requests request JOIN source_catalog source ON source.id=request.source_catalog_id ORDER BY request.created_at DESC`);
    return rows.map((row) => asRequest({ ...row, variable_labels: {} }));
  }
  async create(input: ImportRequestInput): Promise<OfficialImportRequest> {
    const sourceKey = input.sourceKind === "ica" ? "ica-2007-2023" : "emicron-2025";
    const rawKey = `raw/sha256/${input.checksumSha256.toLowerCase()}/${input.fileName}`;
    const row = await this.#db.execute<Row>(sql`WITH source AS (SELECT id FROM source_catalog WHERE source_key=${sourceKey}), actor AS (SELECT id FROM users WHERE clerk_user_id=${input.proposedBy})
      INSERT INTO official_import_requests (source_catalog_id,proposed_by,status,ciiu_version,period,dataset_version,file_name,checksum_sha256,raw_key,byte_size,evidence_type)
      SELECT source.id,actor.id,'pending_review'::official_import_status,${CIIU_4AC_2022},${input.period},${input.datasetVersion},${input.fileName},${input.checksumSha256},${rawKey},${input.byteSize},${input.sourceKind === "emicron" ? "group_12" : "observed"}::evidence_type FROM source,actor
      RETURNING id,proposed_by,status,ciiu_version,period,dataset_version,file_name,checksum_sha256,raw_key,byte_size,evidence_type,created_at`);
    if (!row[0]) throw new Error("Source catalog or proposing administrator not found");
    const labels = input.variableLabels;
    if (input.sourceKind === "emicron" && Object.entries(labels).some(([key, value]) => /^P\d+$/i.test(key) && !value.trim())) throw new Error("EMICRON P variables require labels");
    for (const [variableKey, label] of Object.entries(labels)) {
      await this.#db.execute(sql`INSERT INTO source_variable_labels (source_catalog_id,variable_key,label,dictionary_url,dataset_version)
        SELECT id,${variableKey},${label},${input.officialUrl},${input.datasetVersion} FROM source_catalog WHERE source_key=${sourceKey}
        ON CONFLICT (source_catalog_id,dataset_version,variable_key) DO UPDATE SET label=EXCLUDED.label,dictionary_url=EXCLUDED.dictionary_url`);
    }
    return { ...asRequest({ ...row[0], source_key: sourceKey, official_url: input.officialUrl, license_name: input.licenseName, variable_labels: labels }), variableLabels: labels };
  }
  async claimNext(workerId: string): Promise<OfficialImportRequest | null> {
    const rows = await this.#db.execute<Row>(sql`WITH next AS (SELECT id FROM official_import_requests WHERE status='approved'::official_import_status ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE official_import_requests request SET status='processing'::official_import_status,claimed_by=${workerId} FROM next WHERE request.id=next.id RETURNING request.*`);
    if (!rows[0]) return null;
    const enriched = await this.#db.execute<Row>(sql`SELECT request.*,source.source_key,source.official_url,source.license_name FROM official_import_requests request JOIN source_catalog source ON source.id=request.source_catalog_id WHERE request.id=${rows[0].id}::uuid`);
    return enriched[0] ? asRequest({ ...enriched[0], variable_labels: {} }) : null;
  }
  async review(id: string, reviewerClerkUserId: string, decision: "approved" | "rejected", reason?: string): Promise<void> {
    const result = await this.#db.execute<Row>(sql`UPDATE official_import_requests request SET status=${decision}::official_import_status,reviewed_by=reviewer.id,reviewed_at=now(),review_reason=${reason ?? null}
      FROM users reviewer WHERE request.id=${id}::uuid AND reviewer.clerk_user_id=${reviewerClerkUserId} AND request.proposed_by <> reviewer.id AND request.status='pending_review'::official_import_status RETURNING request.id`);
    if (!result[0]) throw new Error("Review requires a second authorized identity and a pending request");
  }
  async saveIcaMappings(requestId: string, mappings: IcaMapping[]): Promise<"blocked_mapping" | "completed"> {
    await this.#db.transaction(async (tx) => {
      for (const mapping of mappings) await tx.execute(sql`INSERT INTO ica_ciiu_mappings (import_request_id,source_code,source_description,target_ciiu_class,target_ciiu_division,mapping_method,evidence_url,mapping_status,reviewed_at)
        VALUES (${requestId}::uuid,${mapping.sourceCode},${mapping.sourceDescription},${mapping.targetCiiuClass ?? null},${mapping.targetCiiuDivision ?? null},${mapping.mappingMethod ?? null},${mapping.evidenceUrl ?? null},${mapping.mappingStatus}::mapping_status,${mapping.reviewedAt ?? null}::timestamptz)
        ON CONFLICT (import_request_id,source_code) DO UPDATE SET mapping_status=EXCLUDED.mapping_status,target_ciiu_class=EXCLUDED.target_ciiu_class,target_ciiu_division=EXCLUDED.target_ciiu_division,mapping_method=EXCLUDED.mapping_method,evidence_url=EXCLUDED.evidence_url,reviewed_at=EXCLUDED.reviewed_at`);
      const unresolved = await tx.execute<Row>(sql`SELECT 1 FROM ica_ciiu_mappings WHERE import_request_id=${requestId}::uuid AND mapping_status <> 'verified'::mapping_status LIMIT 1`);
      await tx.execute(sql`UPDATE official_import_requests SET status=${unresolved[0] ? "blocked_mapping" : "completed"}::official_import_status WHERE id=${requestId}::uuid`);
    });
    const status = await this.#db.execute<Row>(sql`SELECT status FROM official_import_requests WHERE id=${requestId}::uuid`);
    return status[0]?.status as "blocked_mapping" | "completed";
  }
}
