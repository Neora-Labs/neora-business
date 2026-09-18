import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const licenseReviewStatus = pgEnum("license_review_status", ["pending", "approved", "rejected"]);
export const importStatus = pgEnum("import_status", ["running", "completed", "failed", "duplicate"]);
export const scoreStatus = pgEnum("score_status", ["scored", "insufficient_data"]);
export const role = pgEnum("app_role", ["administrator", "analyst", "commercial_partner", "technical_partner"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), clerkUserId: text("clerk_user_id").notNull().unique(),
  role: role("role").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
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
