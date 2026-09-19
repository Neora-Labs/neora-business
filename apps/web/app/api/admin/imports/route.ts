import { NextResponse } from "next/server";
import { officialImportRequestSchema } from "@neora/contracts";
import { PostgresOfficialIngestionQueue } from "@neora/db";
import { authorize } from "@/lib/auth";
import { requestIdentity } from "@/lib/clerk";
import { canonicalSource, createUploadPlan, localOfficialQueue, publicRequest } from "@/lib/official-ingestion";
import { opportunityRuntime } from "@/lib/runtime";

function postgresQueue() { return process.env.DATABASE_URL ? new PostgresOfficialIngestionQueue(process.env.DATABASE_URL) : null; }
export async function GET() {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "run_import")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const queue = postgresQueue();
  try { return NextResponse.json({ data: (queue ? await queue.list() : localOfficialQueue().list()).map(publicRequest) }); }
  finally { await queue?.close(); }
}
export async function POST(request: Request) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "run_import")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; metadata?: unknown; contentType?: string } | null;
  const parsed = officialImportRequestSchema.safeParse(body?.metadata);
  if (!parsed.success) return NextResponse.json({ error: "Invalid import metadata", issues: parsed.error.flatten() }, { status: 400 });
  try {
    canonicalSource(parsed.data);
    if (body?.action === "upload-plan") return NextResponse.json(await createUploadPlan({ ...parsed.data, contentType: body.contentType ?? "application/octet-stream" }));
    if (body?.action === "confirm-upload") {
      const queue = postgresQueue();
      try {
        const created = queue ? await queue.create({ ...parsed.data, proposedBy: identity.userId }) : localOfficialQueue().create({ ...parsed.data, proposedBy: identity.userId });
        return NextResponse.json({ data: publicRequest(created) }, { status: 201 });
      } finally { await queue?.close(); }
    }
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Import request failed" }, { status: 400 }); }
}
