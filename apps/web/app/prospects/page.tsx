import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { requestIdentity } from "@/lib/clerk";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";
import { opportunityRuntime } from "@/lib/runtime";
import { ProspectExplorer } from "@/components/prospect-explorer";

export const dynamic = "force-dynamic";
export default async function ProspectsPage() {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "view_prospects")) redirect("/");
  const cookieStore = await cookies(); const headerStore = await headers();
  const accountLocale = identity.mode === "clerk" ? await runtime.repository.findPreferredLocaleByClerkUserId(identity.userId) : null;
  const locale = resolveLocale({ accountLocale, cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value ?? null, acceptLanguage: headerStore.get("accept-language") });
  const [list, summary] = await Promise.all([runtime.repository.listProspects({}), runtime.repository.summarizeProspects()]);
  return <ProspectExplorer initialList={list} initialSummary={summary} locale={locale} canImport={identity.role === "administrator"} />;
}
