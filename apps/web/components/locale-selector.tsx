"use client";
import { useTransition } from "react";
import { LOCALE_COOKIE, type Locale, getMessages } from "@/lib/i18n";

export function LocaleSelector({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition(); const t = getMessages(locale);
  return <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4b635c]">
    {t.language}
    <select aria-label={t.language} value={locale} disabled={pending} onChange={(event) => {
      const value = event.target.value as Locale;
      document.cookie = `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = value;
      startTransition(async () => { await fetch("/api/preferences/locale", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: value }) }); window.location.reload(); });
    }} className="rounded-xl border border-[#d6e3df] bg-[#f5f9f7] px-3 py-2.5 text-sm font-semibold text-[#182623] transition hover:border-[#3fd0b4] focus:border-[#087e6b]">
      <option value="es">{t.spanish}</option><option value="en">{t.english}</option>
    </select>
  </label>;
}
