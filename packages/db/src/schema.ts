import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const licenseReviewStatus = pgEnum("license_review_status", ["pending", "approved", "rejected"]);
export const importStatus = pgEnum("import_status", ["running", "completed", "failed", "duplicate"]);
export const scoreStatus = pgEnum("score_status", ["scored", "insufficient_data", "excluded", "pending_validation", "rejected"]);
export const role = pgEnum("app_role", ["administrator", "analyst", "commercial_partner", "technical_partner"]);
export const officialImportStatus = pgEnum("official_import_status", ["pending_review", "approved", "processing", "completed", "failed", "blocked_mapping", "rejected"]);
export const evidenceType = pgEnum("evidence_type", ["observed", "derived", "expert", "group_12"]);
export const mappingStatus = pgEnum("mapping_status", ["verified", "unresolved", "rejected"]);
export const prospectPriority = pgEnum("prospect_priority", ["A", "B", "C"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), clerkUserId: text("clerk_user_id").notNull().unique(),
  role: role("role").notNull(), preferredLocale: text("preferred_locale"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const dataSources = pgTable("data_sources", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), organization: text("organization").notNull(),
  officialUrl: text("official_url"), countryCode: text("country_code").notNull(), licenseName: text("license_name"),
  licenseReviewStatus: licenseReviewStatus("license_review_status").default("pending").notNull(),
  outreachAllowed: boolean("outreach_allowed").default(false).notNull(), cadence: text("cadence"),
  isSynthetic: boolean("is_synthetic").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const datasetVersions = pgTable("dataset_versions", {
  id: uuid("id").defaultRandom().primaryKey(), sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
  period: text("period").notNull(), checksumSha256: text("checksum_sha256").notNull(),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull(), schemaVersion: text("schema_version").notNull(),
  rawUri: text("raw_uri").notNull(), byteSize: integer("byte_size").notNull(), isSynthetic: boolean("is_synthetic").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("dataset_checksum_unique").on(table.sourceId, table.checksumSha256)]);

export const importRuns = pgTable("import_runs", {
  id: uuid("id").defaultRandom().primaryKey(), datasetVersionId: uuid("dataset_version_id").references(() => datasetVersions.id).notNull(),
  status: importStatus("status").notNull(), codeVersion: text("code_version").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(), finishedAt: timestamp("finished_at", { withTimezone: true }),
  rowsRead: integer("rows_read").default(0).notNull(), rowsAccepted: integer("rows_accepted").default(0).notNull(),
  rowsRejected: integer("rows_rejected").default(0).notNull(), errors: jsonb("errors").$type<string[]>().default([]).notNull()
});

export const geographies = pgTable("geographies", {
  id: uuid("id").defaultRandom().primaryKey(), countryCode: text("country_code").notNull(), city: text("city").notNull(),
  officialCode: text("official_code").notNull()
}, (table) => [uniqueIndex("geography_country_code_unique").on(table.countryCode, table.officialCode)]);

export const scoreModelVersions = pgTable("score_model_versions", {
  id: uuid("id").defaultRandom().primaryKey(), kind: text("kind").notNull(), version: text("version").notNull(),
  weights: jsonb("weights").notNull(), minimumCoverage: doublePrecision("minimum_coverage").notNull(),
  active: boolean("active").default(false).notNull(), activatedAt: timestamp("activated_at", { withTimezone: true })
}, (table) => [uniqueIndex("score_model_kind_version_unique").on(table.kind, table.version)]);

export const sectorMetrics = pgTable("sector_metrics", {
  id: uuid("id").primaryKey(), datasetVersionId: uuid("dataset_version_id").references(() => datasetVersions.id).notNull(),
  geographyId: uuid("geography_id").references(() => geographies.id).notNull(), sectorCode: text("sector_code").notNull(),
  sectorName: text("sector_name").notNull(), period: text("period").notNull(), values: jsonb("values").$type<Record<string, number | null>>().notNull()
});

export const sectorScores = pgTable("sector_scores", {
  id: uuid("id").defaultRandom().primaryKey(), geographyId: uuid("geography_id").references(() => geographies.id).notNull(),
  sectorCode: text("sector_code").notNull(), sectorName: text("sector_name").notNull(), period: text("period").notNull(),
  modelVersionId: uuid("model_version_id").references(() => scoreModelVersions.id).notNull(),
  confidenceModelVersionId: uuid("confidence_model_version_id").references(() => scoreModelVersions.id).notNull(),
  datasetVersionId: uuid("dataset_version_id").references(() => datasetVersions.id).notNull(),
  status: scoreStatus("status").notNull(), opportunityScore: doublePrecision("opportunity_score"),
  confidenceScore: doublePrecision("confidence_score"), scorePayload: jsonb("score_payload").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [index("sector_scores_market_idx").on(table.geographyId, table.period)]);

export const sectorScoreFactors = pgTable("sector_score_factors", {
  id: uuid("id").defaultRandom().primaryKey(), sectorScoreId: uuid("sector_score_id").references(() => sectorScores.id).notNull(),
  factorKey: text("factor_key").notNull(), rawValue: doublePrecision("raw_value"), normalizedValue: doublePrecision("normalized_value"),
  weight: doublePrecision("weight").notNull(), contribution: doublePrecision("contribution"), transformation: text("transformation").notNull(),
  evidenceUri: text("evidence_uri").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
});

export const confidenceScoreFactors = pgTable("confidence_score_factors", {
  id: uuid("id").defaultRandom().primaryKey(), sectorScoreId: uuid("sector_score_id").references(() => sectorScores.id).notNull(),
  factorKey: text("factor_key").notNull(), normalizedValue: doublePrecision("normalized_value"), weight: doublePrecision("weight").notNull(),
  contribution: doublePrecision("contribution"), evidenceUri: text("evidence_uri").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
});

export const evidenceRecords = pgTable("evidence_records", {
  id: text("id").primaryKey(), sectorScoreId: uuid("sector_score_id").references(() => sectorScores.id).notNull(), title: text("title").notNull(),
  sourceName: text("source_name").notNull(), sourceUri: text("source_uri").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  licenseReviewStatus: licenseReviewStatus("license_review_status").notNull()
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(), actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata").default({}).notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull()
});

/** Pilot-source governance records.  Raw bytes remain in S3; these rows only hold lineage and queue state. */
export const sourceCatalog = pgTable("source_catalog", {
  id: uuid("id").defaultRandom().primaryKey(), sourceKey: text("source_key").notNull().unique(), name: text("name").notNull(),
  organization: text("organization").notNull(), officialUrl: text("official_url").notNull(), licenseName: text("license_name"),
  ciiuVersion: text("ciiu_version").notNull(), latestObservationYear: integer("latest_observation_year"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
export const sourceVariableLabels = pgTable("source_variable_labels", {
  id: uuid("id").defaultRandom().primaryKey(), sourceCatalogId: uuid("source_catalog_id").references(() => sourceCatalog.id).notNull(),
  variableKey: text("variable_key").notNull(), label: text("label").notNull(), dictionaryUrl: text("dictionary_url").notNull(), datasetVersion: text("dataset_version").notNull()
}, (table) => [uniqueIndex("source_variable_label_unique").on(table.sourceCatalogId, table.datasetVersion, table.variableKey)]);
export const officialImportRequests = pgTable("official_import_requests", {
  id: uuid("id").defaultRandom().primaryKey(), sourceCatalogId: uuid("source_catalog_id").references(() => sourceCatalog.id).notNull(),
  proposedBy: uuid("proposed_by").references(() => users.id).notNull(), reviewedBy: uuid("reviewed_by").references(() => users.id),
  status: officialImportStatus("status").notNull(), ciiuVersion: text("ciiu_version").notNull(), period: text("period").notNull(), datasetVersion: text("dataset_version").notNull(),
  fileName: text("file_name").notNull(), checksumSha256: text("checksum_sha256").notNull(), rawKey: text("raw_key").notNull(), byteSize: integer("byte_size").notNull(),
  evidenceType: evidenceType("evidence_type").notNull(), reviewReason: text("review_reason"), claimedBy: text("claimed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), reviewedAt: timestamp("reviewed_at", { withTimezone: true })
}, (table) => [uniqueIndex("official_import_checksum_unique").on(table.sourceCatalogId, table.checksumSha256)]);
export const icaCiiuMappings = pgTable("ica_ciiu_mappings", {
  id: uuid("id").defaultRandom().primaryKey(), importRequestId: uuid("import_request_id").references(() => officialImportRequests.id).notNull(),
  sourceCode: text("source_code").notNull(), sourceDescription: text("source_description").notNull(), targetCiiuClass: text("target_ciiu_class"),
  targetCiiuDivision: text("target_ciiu_division"), mappingMethod: text("mapping_method"), evidenceUrl: text("evidence_url"),
  mappingStatus: mappingStatus("mapping_status").notNull(), reviewedAt: timestamp("reviewed_at", { withTimezone: true })
}, (table) => [uniqueIndex("ica_mapping_versioned_unique").on(table.importRequestId, table.sourceCode)]);

/** Internal commercial data kept separate from source_catalog and market evidence. */
export const prospectImports = pgTable("prospect_imports", {
  id: uuid("id").defaultRandom().primaryKey(), fileName: text("file_name").notNull(), checksumSha256: text("checksum_sha256").notNull().unique(),
  importedBy: uuid("imported_by").references(() => users.id).notNull(), importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  rowsRead: integer("rows_read").notNull(), rowsAccepted: integer("rows_accepted").notNull(), errors: jsonb("errors").$type<string[]>().default([]).notNull(),
});
export const companyProspects = pgTable("company_prospects", {
  id: uuid("id").defaultRandom().primaryKey(), prospectImportId: uuid("prospect_import_id").references(() => prospectImports.id).notNull(),
  externalId: text("external_id").notNull(), companyName: text("company_name").notNull(), sector: text("sector").notNull(), geography: text("geography").notNull(),
  publicUrl: text("public_url").notNull(), fitSignal: text("fit_signal").notNull(), initialProposal: text("initial_proposal").notNull(), priority: prospectPriority("priority").notNull(),
  outreachStatus: text("outreach_status").notNull(), decisionMakerRole: text("decision_maker_role").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("company_prospects_bogota_only", sql`${table.geography} = 'Bogotá'`), uniqueIndex("company_prospect_external_per_import_unique").on(table.prospectImportId, table.externalId), index("company_prospects_sector_status_idx").on(table.sector, table.outreachStatus)]);
