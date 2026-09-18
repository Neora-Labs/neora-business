import { CreateBucketCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { LocalstackContainer } from "@testcontainers/localstack";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";
import { chromium, expect as playwrightExpect } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresOpportunityRepository } from "../../src/index";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "../../../..");
const bucket = "neora-integration-raw";

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  if (process.platform === "win32") {
    return exec(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], { cwd: root, env: environment });
  }
  return exec(command, args, { cwd: root, env: environment });
}

describe("Python to S3/PostgreSQL vertical slice", () => {
  let database: Awaited<ReturnType<InstanceType<typeof PostgreSqlContainer>["start"]>>;
  let localstack: Awaited<ReturnType<InstanceType<typeof LocalstackContainer>["start"]>>;
  let client: ReturnType<typeof postgres>;
  let s3: S3Client;

  beforeAll(async () => {
    try {
      await exec("docker", ["info"], { cwd: root, timeout: 10_000 });
    } catch {
      throw new Error("Docker is required for pnpm test:integration; start Docker Desktop and retry (the integration suite does not fabricate a pass when unavailable).");
    }
    [database, localstack] = await Promise.all([
      new PostgreSqlContainer("postgres:17-alpine").start(),
      new LocalstackContainer("localstack/localstack:4.8").withEnvironment({ SERVICES: "s3" }).start()
    ]);
    client = postgres(database.getConnectionUri(), { max: 1 });
    for (const migration of ["0001_vertical_slice.sql", "0002_runtime_persistence.sql"]) {
      await client.unsafe(await readFile(resolve(root, "packages/db/migrations", migration), "utf8"));
    }
    const endpoint = localstack.getConnectionUri();
    s3 = new S3Client({ region: "sa-east-1", endpoint, forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } });
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  });

  afterAll(async () => {
    await client?.end();
    s3?.destroy();
    await Promise.all([database?.stop(), localstack?.stop()]);
  });

  it("normalizes and imports twice without duplicating immutable data", async () => {
    const env = {
      ...process.env,
      NEORA_LOCAL_DEMO: "false",
      DATABASE_URL: database.getConnectionUri(),
      RAW_ASSET_BUCKET: bucket,
      AWS_REGION: "sa-east-1",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      S3_ENDPOINT: localstack.getConnectionUri(),
      NEORA_IMPORT_ACTOR: "integration-clerk-user",
      NEORA_IMPORT_RUN_ID: "22222222-2222-4222-8222-222222222222"
    };
    await client`INSERT INTO users (clerk_user_id,role) VALUES ('integration-clerk-user','analyst')`;
    await run("pnpm", ["data:sample"], env);
    await run("uv", ["run", "--project", "pipelines", "python", "-m", "pipelines.src.run_sample", "--handoff", "data/runtime/normalized-batch.json"], env);
    await run("pnpm", ["exec", "tsx", "scripts/import-sample.ts"], env);
    await run("pnpm", ["exec", "tsx", "scripts/import-sample.ts"], env);

    const [counts] = await client`SELECT
      (SELECT count(*)::int FROM dataset_versions) datasets,
      (SELECT count(*)::int FROM import_runs) runs,
      (SELECT count(*)::int FROM sector_metrics) metrics,
      (SELECT count(*)::int FROM sector_scores) scores,
      (SELECT count(*)::int FROM evidence_records) evidence`;
    expect(counts).toMatchObject({ datasets: 1, runs: 2, metrics: 15, scores: 15, evidence: 180 });
    const importRuns = await client`SELECT id,status FROM import_runs ORDER BY started_at`;
    expect(importRuns.map((row) => row.status)).toEqual(["completed", "duplicate"]);
    expect(new Set(importRuns.map((row) => row.id)).size).toBe(2);
    const models = await client`SELECT kind,weights,minimum_coverage FROM score_model_versions ORDER BY kind`;
    expect(models).toEqual([
      expect.objectContaining({ kind: "confidence", minimum_coverage: 100, weights: expect.objectContaining({ authority: 30 }) }),
      expect.objectContaining({ kind: "sector", minimum_coverage: 65, weights: expect.objectContaining({ digital_gap: 20 }) })
    ]);
    expect((await s3.send(new ListObjectsV2Command({ Bucket: bucket }))).KeyCount).toBe(1);

    const repository = new PostgresOpportunityRepository(database.getConnectionUri());
    expect(await repository.findRoleByClerkUserId("integration-clerk-user")).toBe("analyst");
    expect(await repository.listImportRuns()).toHaveLength(2);
    expect(await repository.listMarketScores({ researchMode: false })).toEqual([]);
    expect(await repository.listMarketScores({ researchMode: true })).toHaveLength(15);
    await repository.close();
  });

  it("serves the Docker-loaded fixture through the real web GET boundary", async () => {
    await client`UPDATE data_sources SET license_review_status='approved' WHERE is_synthetic=true`;
    const port = 4317;
    const webEnvironment = {
      ...process.env,
      NODE_ENV: "development",
      NEORA_LOCAL_DEMO: "false",
      DATABASE_URL: database.getConnectionUri(),
      NEORA_TEST_CLERK_USER_ID: "integration-clerk-user",
      NEXT_DIST_DIR: ".next-docker-integration"
    };
    const nextBinary = resolve(root, "apps/web/node_modules/next/dist/bin/next");
    const web = spawn(process.execPath, [nextBinary, "dev", "--port", String(port)], { cwd: resolve(root, "apps/web"), env: webEnvironment, stdio: ["ignore", "pipe", "pipe"] });
    let serverError = "";
    web.stderr?.on("data", (chunk: Buffer) => { serverError += chunk.toString(); });
    try {
      const response = await waitForHttp(`http://127.0.0.1:${port}/api/markets`, () => serverError);
      expect(response.status).toBe(200);
      expect((await response.json()).data).toHaveLength(15);
      const page = await waitForHttp(`http://127.0.0.1:${port}/`, () => serverError);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("Market Explorer");
      const browser = await chromium.launch({ headless: true });
      try {
        const browserPage = await browser.newPage();
        await browserPage.goto(`http://127.0.0.1:${port}/`);
        await playwrightExpect(browserPage.getByRole("heading", { name: "Market Explorer" })).toBeVisible();
        await playwrightExpect(browserPage.getByTestId("sector-row")).toHaveCount(5);
      } finally {
        await browser.close();
      }
    } finally {
      stopProcess(web);
      await rm(resolve(root, "apps/web/.next-docker-integration"), { recursive: true, force: true });
    }
  });
});

async function waitForHttp(url: string, diagnostics: () => string = () => ""): Promise<Response> {
  const deadline = Date.now() + 90_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status !== 503 && response.status !== 502) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const serverOutput = diagnostics();
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}${serverOutput ? `\nWeb server output:\n${serverOutput}` : ""}`);
}

function stopProcess(child: ChildProcess): void {
  if (child.killed || child.pid === undefined) return;
  if (globalThis.process.platform === "win32") {
    try { execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }); } catch { /* already exited */ }
  } else child.kill("SIGTERM");
}
