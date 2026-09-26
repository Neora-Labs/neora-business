import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { requestIdentity } from "@/lib/clerk";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";
import { loadMarkets } from "@/lib/opportunity-data";
import { opportunityRuntime } from "@/lib/runtime";
import { ProspectExplorer } from "@/components/prospect-explorer";

export const dynamic = "force-dynamic";

type ProspectsPageProps = {
  searchParams?: Promise<{ sector?: string }>;
};

export default async function ProspectsPage(props: ProspectsPageProps) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "view_prospects")) redirect("/");
  const cookieStore = await cookies(); const headerStore = await headers();
  const accountLocale = identity.mode === "clerk" ? await runtime.repository.findPreferredLocaleByClerkUserId(identity.userId) : null;
  const locale = resolveLocale({ accountLocale, cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value ?? null, acceptLanguage: headerStore.get("accept-language") });
  const searchParams = await props.searchParams;
  const initialSector = searchParams?.sector ?? "";
  const [list, summary, scores] = await Promise.all([
    runtime.repository.listProspects(initialSector ? { sector: initialSector } : {}),
    runtime.repository.summarizeProspects(),
    loadMarkets(runtime.repository, identity).catch(() => []),
  ]);
  return (
    <ProspectExplorer
      initialList={list}
      initialSummary={summary}
      scores={scores}
      initialSector={initialSector}
      locale={locale}
      canImport={identity.role === "administrator"}
    />
  );
}
