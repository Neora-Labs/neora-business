import { createHash, randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createOpportunityRepository, LocalRawAssetStore, S3RawAssetStore,
  type OpportunityImportBundle, type RawAssetStore
} from "@neora/db";
import { CONFIDENCE_MODEL_V1, SECTOR_MODEL_V1 } from "@neora/scoring";
import generated from "../apps/web/data/market-scores.generated.json";

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5"; hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0,8).join("")}-${hex.slice(8,12).join("")}-${hex.slice(12,16).join("")}-${hex.slice(16,20).join("")}-${hex.slice(20).join("")}`;
}

async function runtimeAdapters(): Promise<{ repository: ReturnType<typeof createOpportunityRepository>["repository"]; rawAssets: RawAssetStore; close?: () => Promise<void> }> {
  if (process.env.NEORA_RESET_DEMO_DATA === "true" && process.env.NEORA_LOCAL_DEMO === "true") {
    await rm(resolve(process.env.NEORA_DEMO_DATA_DIR ?? "data/runtime"), { recursive: true, force: true });
  }
  const runtime = createOpportunityRepository();
  if (runtime.mode === "postgres") {
    if (!process.env.RAW_ASSET_BUCKET) throw new Error("RAW_ASSET_BUCKET is required outside local demo mode");
    return { ...runtime, rawAssets: new S3RawAssetStore(process.env.RAW_ASSET_BUCKET, process.env.AWS_REGION ?? "sa-east-1", undefined, process.env.S3_ENDPOINT) };
  }
  const root = resolve(process.env.NEORA_DEMO_DATA_DIR ?? "data/runtime");
  return { ...runtime, rawAssets: new LocalRawAssetStore(resolve(root, "raw")) };
}

async function main() {
  const handoff = JSON.parse(await readFile(resolve("data/runtime/normalized-batch.json"), "utf8")) as { checksum: string; rows: Array<Record<string, unknown>> };
  if (handoff.checksum !== generated.checksumSha256) throw new Error("Python handoff checksum does not match generated scores");
  const sourcePath = resolve("data/samples/colombia_sector_metrics.synthetic.csv");
  const adapters = await runtimeAdapters();
  try {
    const rawUri = await adapters.rawAssets.putImmutable({ path: sourcePath, checksum: handoff.checksum, contentType: "text/csv" });
    const sourceId = stableUuid("neora:source:synthetic-colombia-sector-v1");
    const datasetId = stableUuid(`neora:dataset:${sourceId}:${handoff.checksum}`);
    // CI/integration retries can intentionally replay the exact same request;
    // production callers should omit this and receive a fresh run id.
    const importId = process.env.NEORA_IMPORT_RUN_ID ?? randomUUID();
    const now = new Date().toISOString();
    const metrics = handoff.rows.map((row) => ({
      id: stableUuid(`metric:${datasetId}:${row.city}:${row.sector_code}`), city: String(row.city), sectorCode: String(row.sector_code),
      sectorName: String(row.sector), period: String(row.period),
      values: Object.fromEntries(["digital_gap","automation_potential","economic_capacity","accessible_market","competitive_pressure","service_fit","accessibility"].map((key) => [key, row[key] as number | null]))
    }));
    const scores: OpportunityImportBundle["scores"] = generated.scores.map((score) => ({ ...score,
      id: stableUuid(`score:${datasetId}:${score.city}:${score.sectorCode}:1.0.0`)
    }));
    const bundle: OpportunityImportBundle = {
      source: { id: sourceId, name: "Synthetic sample", organization: "Neora Labs", officialUrl: null, countryCode: "CO", licenseName: null, licenseReviewStatus: "pending", isSynthetic: true },
      dataset: { id: datasetId, period: "2025", checksumSha256: handoff.checksum, downloadedAt: now, schemaVersion: "1", rawUri, byteSize: (await stat(sourcePath)).size },
      importRun: { id: importId, codeVersion: process.env.GITHUB_SHA ?? "local", rowsRead: metrics.length, rowsAccepted: metrics.length, rowsRejected: 0 },
      models: {
        opportunity: { kind: "sector", version: SECTOR_MODEL_V1.version, weights: Object.fromEntries(SECTOR_MODEL_V1.factors.map((factor) => [factor.key, factor.weight])), minimumCoverage: SECTOR_MODEL_V1.minimumCoverage },
        confidence: { kind: "confidence", version: CONFIDENCE_MODEL_V1.version, weights: Object.fromEntries(CONFIDENCE_MODEL_V1.factors.map((factor) => [factor.key, factor.weight])), minimumCoverage: CONFIDENCE_MODEL_V1.minimumCoverage }
      },
      metrics, scores, audit: { id: randomUUID(), actorId: process.env.NEORA_IMPORT_ACTOR ?? "local-demo-user", action: "import.completed", occurredAt: now }
    };
    const result = await adapters.repository.persistImport(bundle);
    const visible = await adapters.repository.listMarketScores({ researchMode: true });
    console.log(JSON.stringify({ adapter: process.env.NEORA_LOCAL_DEMO === "true" ? "local-file" : "postgres+s3", ...result, visibleScores: visible.length, checksum: handoff.checksum }));
  } finally { await adapters.close?.(); }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
