import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalFileOpportunityRepository, PostgresOpportunityRepository, createOpportunityRepository, resolveLocalDemoRepositoryPath } from "../src/index";

describe("runtime repository factory", () => {
  it("uses local persistence only when demo mode is explicitly enabled", () => {
    const runtime = createOpportunityRepository({ NEORA_LOCAL_DEMO: "true", NEORA_DEMO_DATA_DIR: "demo-data" });
    expect(runtime.mode).toBe("local-demo");
    expect(runtime.repository).toBeInstanceOf(LocalFileOpportunityRepository);
  });

  it("requires PostgreSQL outside explicit demo mode", () => {
    expect(() => createOpportunityRepository({})).toThrow(/DATABASE_URL/);
  });

  it("never enables local persistence in production", () => {
    expect(() => createOpportunityRepository({ NODE_ENV: "production", NEORA_LOCAL_DEMO: "true" })).toThrow(/DATABASE_URL/);
  });

  it("uses PostgreSQL when configured", async () => {
    const runtime = createOpportunityRepository({ DATABASE_URL: "postgresql://user:pass@localhost/db" });
    expect(runtime.mode).toBe("postgres");
    expect(runtime.repository).toBeInstanceOf(PostgresOpportunityRepository);
    await runtime.close?.();
  });

  it("resolves local storage from an explicit caller base instead of the process cwd", () => {
    const workspaceRoot = resolve("virtual-workspace");
    const importCallerBase = workspaceRoot;
    const webCallerBase = resolve(workspaceRoot, "apps", "web", "..", "..");

    const importedFile = resolveLocalDemoRepositoryPath({}, { localDemoBaseDirectory: importCallerBase });
    const servedFile = resolveLocalDemoRepositoryPath({}, { localDemoBaseDirectory: webCallerBase });

    expect(importedFile).toBe(resolve(workspaceRoot, "data", "runtime", "neora-demo.json"));
    expect(servedFile).toBe(importedFile);
  });

  it("keeps an explicit demo data override ahead of the caller default", () => {
    const workspaceRoot = resolve("virtual-workspace");
    const override = resolve("isolated-demo-data");

    expect(resolveLocalDemoRepositoryPath(
      { NEORA_DEMO_DATA_DIR: override },
      { localDemoBaseDirectory: workspaceRoot },
    )).toBe(resolve(override, "neora-demo.json"));
  });
});
