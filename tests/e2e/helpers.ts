import { expect, type Locator, type Page } from "@playwright/test";

/** Entra come Ospite e crea una lega: è il punto di partenza di tutti i percorsi sulle tappe.
 *  (Un ospite nuovo non ha leghe, quindi dopo l'accesso l'app mostra l'elenco /leghe.) */
export async function ospiteConLega(page: Page, nome = "Lega di prova") {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByLabel(/Nome della nuova lega/i).fill(nome);
  await page.getByRole("button", { name: /Crea lega/i }).click();
  await expect(page).toHaveURL(/\/lega$/);
}

/** Una tappa con 4 squadre in 2 gironi (una partita per girone) e il sorteggio fatto: bastano due risultati per arrivare al tabellone.
 *  Parte da `ospiteConLega`. */
export async function tappaConDuePartite(page: Page) {
  await ospiteConLega(page);
  await page.getByLabel("Numero squadre").fill("4");
  await page.getByLabel("Numero gironi").fill("2");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
}

/** Scrive il risultato della prima partita ancora aperta e lo salva */
export async function salvaPrimaPartitaAperta(page: Page) {
  await page.locator("input.scorein").nth(0).fill("21");
  await page.locator("input.scorein").nth(1).fill("15");
  await page.getByRole("button", { name: /Salva risultato/i }).first().click();
}

/** Una risposta JSON del server finto */
export const json = (corpo: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });

/** Un giocatore dell'anagrafe, scritto da Anna (id "u1", l'utente di `utenteRegistrato`): lei può modificarlo ed eliminarlo */
export function giocatoreDiAnna(id: string, nome: string, cognome: string) {
  return {
    id, nome, cognome, soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "", peso: "", ruolo: "Guardia",
    numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
  };
}

/** Una squadra dell'anagrafe, scritta da Anna */
export function squadraDiAnna(id: string, nome: string) {
  return {
    id, nome, citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
    autore: "Anna", autoreId: "u1", ts: 1,
  };
}

/** Un utente registrato (Anna) senza il backend: la sessione e il token stanno già nel browser (un JWT finto che scade nel 2100, così
 *  non si rinnova) e le risposte del server le decide il test. Le leghe sono vuote; l'anagrafe è quella passata. Va chiamata prima di
 *  aprire la pagina. */
export async function utenteRegistrato(page: Page, anagrafe: { giocatori?: unknown[]; squadre?: unknown[] } = {}) {
  const utente = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" };
  await page.addInitScript((u) => {
    // Del JWT finto conta solo `exp` nel payload: header e firma non si leggono
    const payload = btoa(JSON.stringify({ exp: 4102444800 }));
    localStorage.setItem("hoop3x3_token", `x.${payload}.x`);
    localStorage.setItem("hoop3x3_session", JSON.stringify({ ...u, guest: false }));
  }, utente);
  await page.route("**/api/auth/me", (route) => route.fulfill(json(utente)));
  await page.route("**/api/leghe", (route) => route.fulfill(json([])));
  await page.route("**/api/anagrafe/giocatori", (route) => route.fulfill(json(anagrafe.giocatori ?? [])));
  await page.route("**/api/anagrafe/squadre", (route) => route.fulfill(json(anagrafe.squadre ?? [])));
}

/** Preme Tab finché `elemento` ha il focus, come chi usa la tastiera; fallisce se non ci arriva entro `max` pressioni */
export async function tabFinoA(page: Page, elemento: Locator, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await elemento.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Con Tab non si arriva a ${elemento} in ${max} pressioni`);
}
