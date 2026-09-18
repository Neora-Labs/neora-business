import { NextResponse } from "next/server";
import { requestIdentity } from "@/lib/clerk";
import { loadImportRuns } from "@/lib/opportunity-data";
import { opportunityRuntime } from "@/lib/runtime";

export async function GET() {
  const runtime = opportunityRuntime();
  const identity = await requestIdentity(runtime.repository);
  try {
    const data = await loadImportRuns(runtime.repository, identity);
    return NextResponse.json({ data, execution: "local-or-github-actions" });
  } catch (error) {
    if ((error as { status?: number }).status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
