import { test, expect, type Page } from "@playwright/test";
import { errore, json, rispondiAlRisveglio, tappaPubblica, utenteRegistrato } from "./helpers";

/* Le statistiche dell'anagrafe vengono dalle tappe pubblicate nell'Archivio circuito (pubbliche) più la lega aperta: le vede
 * anche chi non ha leghe, e un ospite. Il server finto risponde a GET /api/archivio/tappe come quello vero. */

/** La pubblicazione finta: Anna, della squadra Falchi, ha segnato 12 punti in una partita giocata */
const conTabellino = {
  ...tappaPubblica,
  tappa: {
    ...tappaPubblica.tappa,
    partite: [{ ...tappaPubblica.tappa.partite[0], pa: { p1: { pt: 12 } } }],
  },
};

/** Apre l'anagrafe dalla navigazione e poi la scheda «Statistiche stagione» */
async function apriStatistiche(page: Page) {
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Anagrafe" }).click();
  await page.getByRole("tab", { name: "Statistiche stagione" }).click();
}

test("un utente registrato senza leghe vede i punteggi delle tappe pubblicate", async ({ page }) => {
  await utenteRegistrato(page);
  await page.route("**/api/archivio/tappe", (route) => route.fulfill(json([conTabellino])));
  await page.goto("/leghe");
  await apriStatistiche(page);
  const riga = page.getByRole("row", { name: /Anna/ });
  await expect(riga).toBeVisible();
  await expect(riga.getByRole("cell", { name: "12", exact: true }).first()).toBeVisible();
});

test("un ospite vede gli stessi punteggi", async ({ page }) => {
  await rispondiAlRisveglio(page);
  await page.route("**/api/anagrafe/**", (route) => route.fulfill(json([])));
  await page.route("**/api/archivio/tappe", (route) => route.fulfill(json([conTabellino])));
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await apriStatistiche(page);
  const riga = page.getByRole("row", { name: /Anna/ });
  await expect(riga).toBeVisible();
  await expect(riga.getByRole("cell", { name: "12", exact: true }).first()).toBeVisible();
});

test("se l'archivio risponde con un errore compare «Riprova», e al riprovare la tabella si riempie", async ({ page }) => {
  await utenteRegistrato(page);
  let fallisci = true;
  await page.route("**/api/archivio/tappe", (route) => {
    if (fallisci) return route.fulfill(errore(500, "Errore del server"));
    return route.fulfill(json([conTabellino]));
  });
  await page.goto("/leghe");
  await apriStatistiche(page);
  await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
  // Mai una tabella vuota spacciata per «nessuna statistica»
  await expect(page.getByText(/Nessuna statistica disponibile/)).toHaveCount(0);

  fallisci = false;
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByRole("row", { name: /Anna/ })).toBeVisible();
});
