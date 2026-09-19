import { NextResponse } from "next/server";
import { PostgresOfficialIngestionQueue } from "@neora/db";
import { authorize } from "@/lib/auth";
import { requestIdentity } from "@/lib/clerk";
import { localOfficialQueue, publicRequest } from "@/lib/official-ingestion";
import { opportunityRuntime } from "@/lib/runtime";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "activate_model")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { decision?: "approved" | "rejected"; reason?: string } | null;
  if (!body || (body.decision !== "approved" && body.decision !== "rejected")) return NextResponse.json({ error: "Invalid review decision" }, { status: 400 });
  const result = await context.params;
  try {
    if (process.env.DATABASE_URL) {
      const queue = new PostgresOfficialIngestionQueue(process.env.DATABASE_URL);
      try { await queue.review(result.id, identity.userId, body.decision, body.reason); return NextResponse.json({ data: { id: result.id, status: body.decision } }); }
      finally { await queue.close(); }
    }
    const item = localOfficialQueue().get(result.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.proposedBy === identity.userId) return NextResponse.json({ error: "A second authorized identity must review this import" }, { status: 409 });
    item.status = body.decision === "approved" ? "approved" : "rejected"; item.reviewedBy = identity.userId; item.reviewedAt = new Date().toISOString(); item.reviewReason = body.reason ?? null;
    return NextResponse.json({ data: publicRequest(localOfficialQueue().update(item)) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Review failed" }, { status: 400 }); }
}
