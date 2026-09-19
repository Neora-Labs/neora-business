import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Manrope } from "next/font/google";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
export const metadata: Metadata = { title: "Neora Opportunity Index", description: "Internal market intelligence pilot" };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies(); const headerStore = await headers();
  const locale = resolveLocale({ cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value ?? null, acceptLanguage: headerStore.get("accept-language") });
  return <html lang={locale} className={manrope.variable}><body>{children}</body></html>;
}
