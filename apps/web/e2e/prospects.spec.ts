import { expect, test } from "@playwright/test";

test("shows the protected Bogotá-only prospect workspace in its empty demo state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Company prospects" }).click();
  await expect(page).toHaveURL(/\/prospects$/);
  await expect(page.getByRole("heading", { name: "Company prospects" })).toBeVisible();
  await expect(page.getByText("This is not a nationwide coverage map. All recorded prospects are in Bogotá.")).toBeVisible();
  await expect(page.getByText("No prospects match the selected filters.")).toBeVisible();
  await expect(page.getByLabel("Choose CSV file")).toBeVisible();
});

test("translates the prospect workspace without changing coverage semantics", async ({ page }) => {
  await page.goto("/prospects");
  await page.getByLabel("Language").selectOption("es");
  await expect(page.getByRole("heading", { name: "Prospectos de empresas" })).toBeVisible();
  await expect(page.getByText("No es un mapa de cobertura nacional. Todos los prospectos registrados están en Bogotá.")).toBeVisible();
});
