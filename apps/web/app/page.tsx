import { cookies, headers } from "next/headers";
import { MarketExplorer } from "@/components/market-explorer";
import { requestIdentity } from "@/lib/clerk";
import { LOCALE_COOKIE, getMessages, resolveLocale } from "@/lib/i18n";
import { loadImportRuns, loadMarkets } from "@/lib/opportunity-data";
import { opportunityRuntime } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  const cookieStore = await cookies(); const headerStore = await headers();
  const accountLocale = identity?.mode === "clerk" ? await runtime.repository.findPreferredLocaleByClerkUserId(identity.userId) : null;
  const locale = resolveLocale({ accountLocale, cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value ?? null, acceptLanguage: headerStore.get("accept-language") }); const t = getMessages(locale);
  if (!identity) return <main className="mx-auto max-w-3xl p-10"><h1 className="text-3xl font-semibold">{t.accessDenied}</h1><p className="mt-3 text-slate-400">{t.noRole}</p></main>;
  const scores = await loadMarkets(runtime.repository, identity); const importRuns = await loadImportRuns(runtime.repository, identity, 5).catch(() => []); const cities = Array.from(new Set(scores.map((score) => score.city)));
  return <MarketExplorer scores={scores} cities={cities} importRuns={importRuns} locale={locale} />;
}
