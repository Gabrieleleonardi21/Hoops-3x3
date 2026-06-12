import { test, expect } from "@playwright/test";

test("registrazione punteggio valido 3x3", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
  const prima = page.locator("div").filter({ hasText: /^.*-.*Salva/ }).first();
  await prima.locator("input").nth(0).fill("21");
  await prima.locator("input").nth(1).fill("15");
  await prima.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("21 - 15").first()).toBeVisible();
});
