import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const password = "Strong-Browser-Password-2026";

async function login(page: Page, email = "ananya.rao@northstar.example") {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("authenticated overview uses purposeful Indian enterprise data", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Product overview" }),
  ).toBeVisible();
  await expect(page.getByText("₹", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Synthetic data|Local demo/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Revenue trajectory" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("streams an investigation, exposes evidence, and gates report export", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: /New investigation/ }).click();
  await page.getByRole("button", { name: "Run investigation" }).click();
  await expect(
    page.getByText("Workspace verified. Preparing the investigation."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Evidence review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Atlas Pro 14" }),
  ).toBeVisible();
  await expect(page.getByText("42 tickets", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await expect(
    page.getByText("northstar-p1-warranty-v1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export report" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Approve and download" }).click();
  expect((await download).suggestedFilename()).toMatch(/^northstar-.*\.md$/);
});

test("role-based navigation hides unavailable capabilities", async ({
  page,
}) => {
  await login(page, "rahul.menon@northstar.example");
  await expect(
    page.getByRole("heading", { name: "Agent workspace" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Investigations" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Overview" })).toHaveCount(0);
  await expect(
    page.getByRole("complementary").getByText("Support specialist"),
  ).toBeVisible();
});

test("administrator sees operations and governed access", async ({ page }) => {
  await login(page, "arjun.iyer@northstar.example");
  await page.getByRole("link", { name: "Operations" }).click();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(page.getByText("Blocked by spending policy")).toBeVisible();
  await page.getByRole("link", { name: "People & access" }).click();
  await expect(
    page.getByRole("heading", { name: "People and access" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Ananya Rao ananya\.rao@/ }),
  ).toBeVisible();
});
