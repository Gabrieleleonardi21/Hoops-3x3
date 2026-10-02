import { test, expect } from "@playwright/test";
import { ospiteConLega } from "./helpers";

test("sorteggio casuale da Ospite (controlli roster disattivati)", async ({ page }) => {
  await ospiteConLega(page);
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
  await expect(page.getByRole("heading", { name: /Girone A/i })).toBeVisible();
});
