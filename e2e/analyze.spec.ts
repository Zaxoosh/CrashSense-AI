import { expect, test } from "@playwright/test";

test("shows validation when analysis is submitted without a log", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("analyze-button").click();

  await expect(page.getByTestId("error-alert")).toContainText("Paste a crash log");
});

test("surfaces AI provider failure for generic crashes", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("log-input").fill("RuntimeException: handler failed inside app startup");
  await page.getByTestId("analyze-button").click();

  await expect(page.getByTestId("ai-status")).toContainText("failed", { timeout: 15_000 });
  await expect(page.getByTestId("ai-status")).toContainText("Could not reach AI provider");
});

test("can force AI triage from the primary form", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("log-input").fill("listen tcp 0.0.0.0:8080: bind: address already in use");
  await page.getByTestId("force-ai-button").click();

  await expect(page.getByTestId("ai-status")).toContainText("failed", { timeout: 15_000 });
});
