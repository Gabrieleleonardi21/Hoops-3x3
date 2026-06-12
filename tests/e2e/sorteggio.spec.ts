import { test, expect } from "@playwright/test";

test("sorteggio casuale da Ospite (controlli roster disattivati)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
  await expect(page.getByText(/Girone A/i)).toBeVisible();
});
