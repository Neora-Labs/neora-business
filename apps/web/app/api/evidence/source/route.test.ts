import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { requestIdentity, repository } = vi.hoisted(() => ({ requestIdentity: vi.fn(), repository: { findRoleByClerkUserId: vi.fn() } }));
vi.mock("../../../../lib/clerk", () => ({ requestIdentity }));
vi.mock("../../../../lib/runtime", () => ({ opportunityRuntime: () => ({ mode: "postgres", repository }) }));

const sourceRequest = () => new NextRequest("http://localhost/api/evidence/source?dataset=colombia_sector_metrics.synthetic.csv");

describe("evidence source authorization", () => {
  beforeEach(() => requestIdentity.mockReset());

  it("rejects unauthenticated requests", async () => {
    requestIdentity.mockResolvedValue(null);
    const response = await GET(sourceRequest());
    expect(response.status).toBe(403);
  });

  it("rejects an authenticated Clerk user without a database role", async () => {
    requestIdentity.mockResolvedValue(null);
    const response = await GET(sourceRequest());
    expect(response.status).toBe(403);
    expect(requestIdentity).toHaveBeenCalledWith(repository);
  });

  it("serves the allowlisted source to a role with view_markets", async () => {
    requestIdentity.mockResolvedValue({ userId: "analyst", role: "analyst", mode: "clerk" });
    const response = await GET(sourceRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).synthetic).toBe(true);
  });
});
