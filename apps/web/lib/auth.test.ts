import { describe, expect, it } from "vitest";
import { resolveRoleIdentity } from "./auth";

describe("production identity role resolution", () => {
  it("loads the authoritative role rather than assigning one to a Clerk identity", async () => {
    const identity = await resolveRoleIdentity("clerk-user", async () => "analyst");
    expect(identity).toEqual({ userId: "clerk-user", role: "analyst", mode: "clerk" });
  });
  it("rejects Clerk users without a database role", async () => {
    expect(await resolveRoleIdentity("clerk-user", async () => null)).toBeNull();
  });
});
