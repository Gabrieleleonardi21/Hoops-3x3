import { expect, type Page } from "@playwright/test";

/** Entra come Ospite e crea una lega: è il punto di partenza di tutti i percorsi sulle tappe.
 *  (Un ospite nuovo non ha leghe, quindi dopo l'accesso l'app mostra l'elenco /leghe.) */
export async function ospiteConLega(page: Page, nome = "Lega di prova") {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByLabel(/Nome della nuova lega/i).fill(nome);
  await page.getByRole("button", { name: /Crea lega/i }).click();
  await expect(page).toHaveURL(/\/lega$/);
}
