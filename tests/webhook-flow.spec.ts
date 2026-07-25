import { test, expect } from "@playwright/test";

test.describe("Dynamic Webhooks Core Features", () => {
  test("Landing Page renders successfully with value propositions", async ({ page }) => {
    // Navigate to local home page
    await page.goto("http://localhost:3000/");

    // Check if hero title exists
    const title = page.locator("h1");
    await expect(title).toContainText("Unrate-limited Webhook Inspection");

    // Check if call to action buttons exist
    const ossBtn = page.locator("text=Compare OSS vs Managed Cloud");
    await expect(ossBtn).toBeVisible();
  });

  test("Pricing Page renders custom billing table", async ({ page }) => {
    await page.goto("http://localhost:3000/pricing");
    const pricingHeader = page.locator("h1");
    await expect(pricingHeader).toBeVisible();
  });
});
