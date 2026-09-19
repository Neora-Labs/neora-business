import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { requestIdentity } from "@/lib/clerk";
import { parseProspectCsv } from "@/lib/prospect-csv";
import { opportunityRuntime } from "@/lib/runtime";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "view_prospects")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1"); const pageSize = Number(searchParams.get("pageSize") ?? "25");
  const sector = searchParams.get("sector"); const outreachStatus = searchParams.get("outreachStatus"); const priority = searchParams.get("priority");
  const data = await runtime.repository.listProspects({ page: Number.isFinite(page) ? page : 1, pageSize: Number.isFinite(pageSize) ? pageSize : 25, ...(sector ? { sector } : {}), ...(outreachStatus ? { outreachStatus } : {}), ...(priority === "A" || priority === "B" || priority === "C" ? { priority } : {}) });
  const summary = await runtime.repository.summarizeProspects();
  return NextResponse.json({ ...data, summary });
}

export async function POST(request: Request) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || identity.role !== "administrator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_CSV_BYTES || !file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Invalid prospect file" }, { status: 400 });
  try {
    const text = await file.text(); const parsed = parseProspectCsv(text);
    const checksumSha256 = createHash("sha256").update(text, "utf8").digest("hex");
    const safeName = file.name.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 255);
    const result = await runtime.repository.persistProspectImport({ import: { fileName: safeName, checksumSha256, importedBy: identity.userId, importedAt: new Date().toISOString() }, prospects: parsed.records.map((item) => ({ ...item, geography: "Bogotá" })) });
    return NextResponse.json({ data: result }, { status: result.duplicate ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Invalid prospect CSV" }, { status: 400 });
  }
}
