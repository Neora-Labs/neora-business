import { describe, expect, it } from "vitest";
import { getMessages, resolveLocale } from "./i18n";
describe("locale resolution", () => {
  it("uses the account preference before cookie and browser", () => expect(resolveLocale({ accountLocale: "en", cookieLocale: "es", acceptLanguage: "es-CO" })).toBe("en"));
  it("uses a valid cookie before browser", () => expect(resolveLocale({ cookieLocale: "en", acceptLanguage: "es-CO" })).toBe("en"));
  it("detects any Spanish browser variant and falls back to English", () => { expect(resolveLocale({ acceptLanguage: "es-CO,es;q=0.9" })).toBe("es"); expect(resolveLocale({ acceptLanguage: "fr-FR" })).toBe("en"); });
  it("has equivalent catalog keys", () => expect(Object.keys(getMessages("es")).sort()).toEqual(Object.keys(getMessages("en")).sort()));
});
