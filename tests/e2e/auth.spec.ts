// Richiede: npm i -D @playwright/test && npx playwright install
import { test, expect } from "@playwright/test";

test("la home mostra il form di accesso e l'ingresso Ospite", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("HOOP")).toBeVisible();
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toBeVisible();
});

test("l'Ospite entra nella lega", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await expect(page).toHaveURL(/\/lega/);
  await expect(page.getByText(/Modalità Ospite/i)).toBeVisible();
});
