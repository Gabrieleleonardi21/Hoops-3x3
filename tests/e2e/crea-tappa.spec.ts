import { test, expect } from "@playwright/test";

test("creazione tappa da Ospite", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByLabel(/Nome tappa/i).fill("Tappa di prova");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await expect(page).toHaveURL(/\/lega\/tappa\//);
  await expect(page.getByText("TAPPA DI PROVA")).toBeVisible();
});
