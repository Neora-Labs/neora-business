import { MarketExplorer } from "@/components/market-explorer";
import { requestIdentity } from "@/lib/clerk";
import { loadImportRuns, loadMarkets } from "@/lib/opportunity-data";
import { opportunityRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const runtime = opportunityRuntime();
  const identity = await requestIdentity(runtime.repository);
  if (!identity) return <main className="mx-auto max-w-3xl p-10"><h1 className="text-3xl font-semibold">Access denied</h1><p className="mt-3 text-slate-400">Your identity does not have an application role.</p></main>;
  const scores = await loadMarkets(runtime.repository, identity);
  const importRuns = await loadImportRuns(runtime.repository, identity, 5).catch(() => []);
  const cities = Array.from(new Set(scores.map((score) => score.city)));
  return <MarketExplorer scores={scores} cities={cities} importRuns={importRuns} />;
}
