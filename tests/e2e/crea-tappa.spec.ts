import { test, expect } from "@playwright/test";
import { ospiteConLega } from "./helpers";

test("creazione tappa da Ospite", async ({ page }) => {
  await ospiteConLega(page);
  await page.getByLabel(/Nome tappa/i).fill("Tappa di prova");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await expect(page).toHaveURL(/\/lega\/tappa\//);
  await expect(page.getByRole("heading", { name: /tappa di prova/i })).toBeVisible();
});
