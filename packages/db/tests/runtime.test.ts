import { describe, expect, it } from "vitest";
import { LocalFileOpportunityRepository, PostgresOpportunityRepository, createOpportunityRepository } from "../src/index";

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
});
