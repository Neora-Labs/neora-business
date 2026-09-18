import { NextResponse } from "next/server";
import { requestIdentity } from "@/lib/clerk";
import { loadMarkets } from "@/lib/opportunity-data";
import { opportunityRuntime } from "@/lib/runtime";

export async function GET() {
  const runtime = opportunityRuntime();
  const identity = await requestIdentity(runtime.repository);
  try {
    const data = await loadMarkets(runtime.repository, identity);
    return NextResponse.json({ data, synthetic: runtime.mode === "local-demo" });
  } catch (error) {
    if ((error as { status?: number }).status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
