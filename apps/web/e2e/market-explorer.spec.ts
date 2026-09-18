import { expect, test } from "@playwright/test";

test("shows the three pilot cities, ranked sectors, and evidence details", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Market Explorer" })).toBeVisible();
  await expect(page.getByLabel("City")).toHaveValue("Bogotá");
  await expect(page.getByRole("option", { name: "Medellín" })).toBeAttached();
  await expect(page.getByRole("option", { name: "Cali" })).toBeAttached();
  await expect(page.getByTestId("sector-row")).toHaveCount(5);
  await page.getByTestId("sector-row").first().click();
  await expect(page.getByRole("heading", { name: "Factor evidence" })).toBeVisible();
  await expect(page.getByText("Synthetic sample", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Evidence / })).toHaveCount(7);
  await expect(page.getByRole("link", { name: /^Confidence evidence / })).toHaveCount(5);
  const sourceLink = page.getByRole("link", { name: /^Open source / }).first();
  const sourceResponse = await page.request.get(await sourceLink.getAttribute("href") ?? "");
  expect(sourceResponse.status()).toBe(200);
  await page.getByRole("link", { name: /^Evidence / }).first().click();
  await expect(page).toHaveURL(/#evidence-/);
});

test("makes pending license status and opportunity/confidence separation visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("License review pending")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Opportunity" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Confidence" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Import status" })).toBeVisible();
});

test("serves repository-backed market and import status APIs without a remote trigger", async ({ request }) => {
  const markets = await request.get("/api/markets");
  expect(markets.status()).toBe(200);
  expect((await markets.json()).data).toHaveLength(15);
  const sectors = await request.get("/api/sectors?city=Bogot%C3%A1");
  expect(sectors.status()).toBe(200);
  expect((await sectors.json()).data).toHaveLength(5);
  const imports = await request.get("/api/imports");
  expect(imports.status()).toBe(200);
  expect((await imports.json()).data.length).toBeGreaterThan(0);
  expect((await request.post("/api/imports")).status()).toBe(405);
});
