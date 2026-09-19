import { resolve } from "node:path";
import { resolveLocalDemoRepositoryPath } from "@neora/db";
import { describe, expect, it } from "vitest";
import { resolveWebWorkspaceRoot } from "./runtime";

describe("web repository runtime", () => {
  it("reads the same local demo file written by the root import command", () => {
    const workspaceRoot = resolve("virtual-workspace");
    const webCwd = resolve(workspaceRoot, "apps", "web");
    const importedFile = resolveLocalDemoRepositoryPath({}, { localDemoBaseDirectory: workspaceRoot });
    const servedFile = resolveLocalDemoRepositoryPath({}, { localDemoBaseDirectory: resolveWebWorkspaceRoot(webCwd) });

    expect(servedFile).toBe(importedFile);
  });
});
