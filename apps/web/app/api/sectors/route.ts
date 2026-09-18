import { NextRequest, NextResponse } from "next/server";
import { requestIdentity } from "@/lib/clerk";
import { loadMarkets } from "@/lib/opportunity-data";
import { opportunityRuntime } from "@/lib/runtime";

export async function GET(request: NextRequest) {
  const runtime = opportunityRuntime();
  const identity = await requestIdentity(runtime.repository);
  let marketScores;
  try {
    marketScores = await loadMarkets(runtime.repository, identity);
  } catch (error) {
    if ((error as { status?: number }).status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
  const city = request.nextUrl.searchParams.get("city");
  return NextResponse.json({ data: city ? marketScores.filter((score) => score.city === city) : marketScores });
}
