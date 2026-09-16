import { test, expect } from "@playwright/test";

test("registrazione punteggio valido 3x3", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
  // I due input del punteggio della prima partita (classe .scorein, in ordine DOM)
  await page.locator("input.scorein").nth(0).fill("21");
  await page.locator("input.scorein").nth(1).fill("15");
  await page.getByRole("button", { name: /Salva risultato/i }).first().click();
  // Il punteggio è reso in due elementi separati (ScoreCard): si verificano i due numeri
  await expect(page.getByText("21", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
});
