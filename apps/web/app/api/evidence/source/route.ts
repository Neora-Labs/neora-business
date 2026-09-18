import { NextRequest, NextResponse } from "next/server";
import { authorize } from "../../../../lib/auth";
import { requestIdentity } from "../../../../lib/clerk";
import { opportunityRuntime } from "../../../../lib/runtime";
import generated from "../../../../data/market-scores.generated.json";

const SYNTHETIC_DATASET = "colombia_sector_metrics.synthetic.csv";

/**
 * Serve only the checked-in synthetic fixture referenced by evidence records.
 * This intentionally does not proxy arbitrary filesystem paths or remote URLs.
 */
export async function GET(request: NextRequest) {
  const runtime = opportunityRuntime();
  const identity = await requestIdentity(runtime.repository);
  if (!authorize(identity, "view_markets")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.nextUrl.searchParams.get("dataset") !== SYNTHETIC_DATASET) {
    return NextResponse.json({ error: "Unknown evidence source" }, { status: 404 });
  }

  // Return a static, app-served provenance manifest rather than exposing a
  // filesystem path. The generated JSON import is traceable by Next/Vercel
  // and remains protected by the authorization check above.
  return NextResponse.json({
    dataset: SYNTHETIC_DATASET,
    generatedFrom: generated.generatedFrom,
    checksumSha256: generated.checksumSha256,
    synthetic: generated.synthetic,
    scoreCount: generated.scores.length
  }, { headers: { "cache-control": "private, max-age=3600" } });
}
