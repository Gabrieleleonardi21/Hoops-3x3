import { test, expect, type Page } from "@playwright/test";
import { ospiteConLega } from "./helpers";

/** Il campo file nascosto di «Importa JSON» */
const campoFile = (page: Page) => page.locator("input[type=file]");

/** Sceglie in «Importa JSON» un file con questo contenuto. Il file si costruisce dentro la pagina (File e DataTransfer):
 *  setInputFiles con un contenuto in memoria vuole un Buffer, e i tipi di Node non sono nel progetto. */
async function scegliFile(page: Page, nome: string, contenuto: string) {
  await campoFile(page).evaluate((campo, [nomeFile, testo]) => {
    const dati = new DataTransfer();
    dati.items.add(new File([testo], nomeFile, { type: "application/json" }));
    (campo as HTMLInputElement).files = dati.files;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }, [nome, contenuto]);
}

test("un file incompleto è rifiutato con un messaggio, e l'app resta usabile anche dopo il ricaricamento", async ({ page }) => {
  await ospiteConLega(page);
  // Una tappa senza squadre: prima faceva uscire la pagina bianca, a ogni ricarica
  await scegliFile(page, "rotta.json", JSON.stringify({ nome: "Lega rotta", tappe: [{ nome: "Tappa senza squadre" }] }));
  await expect(page.getByRole("alert")).toHaveText("Import non riuscito: tappe[0]: manca il campo «squadre»");
  await expect(page.getByRole("heading", { name: "Le tappe del circuito" })).toBeVisible();
  // Nel browser non è entrato niente: ricaricando la pagina si disegna ancora
  await page.reload();
  await expect(page.getByRole("heading", { name: "Le tappe del circuito" })).toBeVisible();
});

test("una lega esportata si reimporta come lega nuova, anche se l'originale esiste ancora", async ({ page }) => {
  await ospiteConLega(page, "Lega originale");
  await page.getByLabel(/Nome tappa/i).fill("Tappa da salvare");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await expect(page).toHaveURL(/\/lega\/tappa\//);
  await page.getByRole("link", { name: /Tutte le tappe/i }).click();

  // Il file è quello che scarica «Esporta JSON»; lo si sceglie in «Importa JSON»
  const [scaricato] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Esporta JSON/i }).click(),
  ]);
  await campoFile(page).setInputFiles(await scaricato.path());

  // Si apre la lega importata, con la tappa; l'originale c'è ancora: le leghe sono due
  await expect(page.getByText("Tappa da salvare")).toBeVisible();
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Le mie leghe" }).click();
  await expect(page.getByText("Lega originale", { exact: true })).toHaveCount(2);
});
