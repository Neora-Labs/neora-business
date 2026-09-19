import { expect, test } from "@playwright/test";

test("switches dashboard interface language and remembers it in a cookie", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Language").selectOption("es");
  await expect(page.getByRole("heading", { name: "Explorador de mercados" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByLabel("Idioma")).toHaveValue("es");
  await expect(page.getByRole("region", { name: "Resumen del mercado" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidencia de factores" })).toBeVisible();
  await expect(page.getByText(/^Observado /).first()).toBeVisible();
  await expect(page.getByText("Modelo de confianza v1.0")).toBeVisible();
  await expect(page.getByText("/ 100").first()).toBeVisible();
  await expect(page.getByText(/^Modelo v1\.0/)).toBeVisible();
  await expect(page.getByLabel("Inicio de Neora Labs")).toBeVisible();
});



