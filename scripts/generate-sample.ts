import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { calculateConfidence, calculateScore, confidenceLabel, SECTOR_MODEL_V1 } from "@neora/scoring";

const aliases: Record<string, string> = { "Bogota D.C.": "Bogotá", Medellin: "Medellín", Cali: "Cali" };
const sectors: Record<string, string> = {
  construction: "Construction & installers", health: "Clinics & wellness", real_estate: "Real estate",
  technical_services: "Technical services", education: "Academies & professional services"
};
const syntheticSourceUri = "/api/evidence/source?dataset=colombia_sector_metrics.synthetic.csv";

async function main() {
  const sourcePath = resolve("data/samples/colombia_sector_metrics.synthetic.csv");
  const payload = await readFile(sourcePath);
  const checksum = createHash("sha256").update(payload).digest("hex");
  const [headerLine, ...lines] = payload.toString("utf8").trim().split(/\r?\n/);
  const headers = headerLine!.split(",");
  const scores = lines.map((line) => {
    const values = line.split(",");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const city = aliases[row.city!]!;
    const factors = SECTOR_MODEL_V1.factors.map((factor) => ({ ...factor, value: row[factor.key] === "" ? null : Number(row[factor.key]), evidenceId: `${city}-${row.sector_code}-${factor.key}` }));
    const result = calculateScore(SECTOR_MODEL_V1, factors);
    const rawConfidenceResult = calculateConfidence({ authority: Number(row.authority), completeness: Number(row.completeness), freshness: Number(row.freshness), consistency: Number(row.consistency), entity_resolution: Number(row.entity_resolution) });
    const confidenceResult = { ...rawConfidenceResult, factors: rawConfidenceResult.factors.map((factor) => ({ ...factor, evidenceId: `${city}-${row.sector_code}-confidence-${factor.key}` })) };
    const confidence = confidenceResult.score;
    const evidence = [...result.factors, ...confidenceResult.factors].map((factor) => ({ id: factor.evidenceId, title: factor.label, observedAt: "2025-12-31", sourceName: "Synthetic sample", sourceUri: syntheticSourceUri, licenseReviewStatus: "pending" as const }));
    return {
      id: `${city}-${row.sector_code}`, city, sectorCode: row.sector_code!, sector: sectors[row.sector_code!]!, period: row.period!, score: result.score,
      confidence, confidenceLabel: confidenceLabel(confidence ?? 0), status: result.status, modelVersion: SECTOR_MODEL_V1.version,
      confidenceModelVersion: "1.0.0", confidenceFactors: confidenceResult.factors,
      source: { name: "Synthetic sample", url: null, observedAt: "2025-12-31", licenseReviewStatus: "pending" as const },
      factors: result.factors, evidence
    };
  });
  const outputDirectory = resolve("apps/web/data");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "market-scores.generated.json"), `${JSON.stringify({ generatedFrom: "data/samples/colombia_sector_metrics.synthetic.csv", checksumSha256: checksum, synthetic: true, scores }, null, 2)}\n`);
  console.log(`Generated ${scores.length} sample scores from SHA-256 ${checksum}`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
