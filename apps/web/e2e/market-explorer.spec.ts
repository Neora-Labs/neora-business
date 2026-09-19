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

test("summarizes the selected city with real score KPIs and dashboard navigation", async ({ page }) => {
  await page.goto("/");

  const overview = page.getByRole("region", { name: "Market overview" });
  await expect(overview.getByTestId("dashboard-kpi")).toHaveCount(4);
  await expect(overview.getByText("Top opportunity")).toBeVisible();
  await expect(overview.getByText("79", { exact: true })).toBeVisible();
  await expect(overview.getByText("Average opportunity")).toBeVisible();
  await expect(overview.getByText("76.4", { exact: true })).toBeVisible();
  await expect(overview.getByText("Evidence confidence")).toBeVisible();
  await expect(overview.getByText("86.7", { exact: true })).toBeVisible();
  await expect(overview.getByText("Evaluated sectors")).toBeVisible();
  await expect(overview.getByText("5", { exact: true })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "#overview");
  await expect(navigation.getByRole("link", { name: "Ranking" })).toHaveAttribute("href", "#ranking");
  await expect(navigation.getByRole("link", { name: "Evidence" })).toHaveAttribute("href", "#evidence");

  await page.getByLabel("City", { exact: true }).selectOption("Cali");
  await expect(overview.getByText("75.8", { exact: true })).toBeVisible();
  await expect(overview.getByText("73.5", { exact: true })).toBeVisible();
  await expect(overview.getByText("80.2", { exact: true })).toBeVisible();
});

test("keeps the dashboard usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByLabel("City")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sector ranking" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
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
