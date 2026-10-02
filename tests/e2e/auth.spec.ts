import { test, expect } from "@playwright/test";

test("la home mostra il form di accesso e l'ingresso Ospite", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /hoop 3x3/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toBeVisible();
});

test("l'Ospite entra e arriva all'elenco delle leghe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await expect(page).toHaveURL(/\/leghe$/);
  await expect(page.getByText(/Modalità Ospite/i)).toBeVisible();
});
