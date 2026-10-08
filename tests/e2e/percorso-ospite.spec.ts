import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  bloccaApiNonPreviste, json, rispondiAlRisveglio, salvaPrimaPartitaAperta, salvaPrimoMatchDelTabellone, tappaConDuePartite,
} from "./helpers";

/** Il server finto dell'Ospite: tutto resta nel browser, ma la pagina della tappa scarica l'anagrafe (in sola lettura) e la risposta la
 *  decide il test. Ogni altra chiamata a /api è un errore.
 *  @returns le chiamate non previste, che a fine test devono essere nessuna */
async function serverFinto(page: Page) {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await page.route("**/api/anagrafe/**", (route) => route.fulfill(json([])));
  await rispondiAlRisveglio(page);
  return nonPreviste;
}

/** La card di un match del tabellone, trovata dall'etichetta della sua intestazione («Semifinale 1», «Finale»): il tabellone non ha ruoli
 *  né nomi accessibili per le sue card, e la colonna con il titolo del turno («Finale») sta fuori dalla card */
const cardDelMatch = (page: Page, etichetta: string) =>
  page.locator("div.overflow-hidden").filter({ has: page.getByText(etichetta, { exact: true }) });

/** La squadra A di un match ancora da giocare, letta dal nome del suo primo campo punteggio («Punti Squadra 3»). Con il 21 a 15 che
 *  scrivono gli helper vince lei: il vincitore si conosce prima di giocare */
async function squadraA(match: Locator) {
  const nome = await match.getByRole("spinbutton").first().getAttribute("aria-label");
  return nome!.replace("Punti ", "");
}

// I singoli passi (crea tappa, sorteggio, punteggio, conferme) li provano già gli altri file: qui conta che il percorso intero regga,
// con ogni fase che si apre solo quando la precedente è finita, e che finisca nel punto giusto
test("percorso dell'Ospite: gironi, tabellone giocato fino alla finale, e «Concludi» bloccato con il suo motivo", async ({ page }) => {
  // Il percorso intero fa più passi di un test normale: i 15 secondi della configurazione bastano a un passo solo, non a una macchina carica
  test.setTimeout(30_000);
  const nonPreviste = await serverFinto(page);

  // Lega, tappa da 4 squadre in 2 gironi, sorteggio
  await tappaConDuePartite(page);
  await expect(page.getByRole("heading", { name: "Girone A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Girone B" })).toBeVisible();

  // Il tabellone non c'è finché un girone ha una partita aperta: dopo il primo risultato ne manca ancora una
  await salvaPrimaPartitaAperta(page);
  await expect(page.getByRole("button", { name: "Correggi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fase finale" })).toHaveCount(0);

  // Il secondo risultato chiude i gironi: compare «Fase finale» e il bracket si genera dalle classifiche (semifinali e finale)
  await salvaPrimaPartitaAperta(page);
  await expect(page.getByRole("heading", { name: "Fase finale" })).toBeVisible();
  await page.getByRole("button", { name: /Genera bracket/i }).click();
  const semifinale1 = cardDelMatch(page, "Semifinale 1");
  const semifinale2 = cardDelMatch(page, "Semifinale 2");
  const finale = cardDelMatch(page, "Finale");
  await expect(semifinale1).toBeVisible();
  await expect(semifinale2).toBeVisible();
  // La finale aspetta i vincitori delle semifinali: i suoi due posti sono ancora da determinare, e non si può giocare
  await expect(finale.getByText("TBD", { exact: true })).toHaveCount(2);
  await expect(finale.getByRole("spinbutton")).toHaveCount(0);

  // Si giocano le semifinali: in finale vanno i due vincitori, il primo nel posto A e il secondo nel posto B
  const vincitore1 = await squadraA(semifinale1);
  await salvaPrimoMatchDelTabellone(page);
  await expect(finale.getByText("TBD", { exact: true })).toHaveCount(1);
  const vincitore2 = await squadraA(semifinale2);
  await salvaPrimoMatchDelTabellone(page);
  await expect(finale.getByText("TBD", { exact: true })).toHaveCount(0);
  await expect(finale.getByRole("spinbutton")).toHaveCount(2);
  await expect(finale.getByRole("spinbutton").nth(0)).toHaveAccessibleName(`Punti ${vincitore1}`);
  await expect(finale.getByRole("spinbutton").nth(1)).toHaveAccessibleName(`Punti ${vincitore2}`);

  // La finale: chi la vince è il campione, e non c'è più niente da giocare
  await expect(finale.getByText("Campione")).toHaveCount(0);
  await salvaPrimoMatchDelTabellone(page);
  await expect(finale.getByText("Campione")).toBeVisible();
  await expect(page.locator("input.scorein")).toHaveCount(0);

  // Con tutto giocato «Concludi» non trova più partite mancanti, ma l'Ospite non può pubblicare: il messaggio lo dice e la tappa resta aperta
  await page.getByRole("button", { name: /Concludi e pubblica la tappa/i }).click();
  await expect(page.getByRole("alert")).toHaveText("La pubblicazione nell'Archivio circuito richiede un account registrato.");
  await expect(page.getByRole("button", { name: /Concludi e pubblica la tappa/i })).toBeVisible();
  await expect(page.getByText(/^Conclusa/)).toHaveCount(0);

  // Il browser tiene tutto: dopo il ricaricamento il tabellone giocato e il campione ci sono ancora, e la tappa non è conclusa
  await page.reload();
  await expect(page.getByText("Campione")).toBeVisible();
  await expect(page.getByRole("button", { name: /Concludi e pubblica la tappa/i })).toBeVisible();
  expect(nonPreviste).toEqual([]);
});
