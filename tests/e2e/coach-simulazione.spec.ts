import { test, expect } from "@playwright/test";
import { bloccaApiNonPreviste, creato, giocatoreDiAnna, json, rispondiAlRisveglio, squadraDiAnna, utenteRegistrato } from "./helpers";

/** La parte della tappa che serve al test: partite dei gironi e tabellone (con i turni superati d'ufficio, che non si giocano) */
interface TappaInviata {
  partite: { done: boolean }[];
  bracket: { bye?: boolean; done: boolean }[];
}

test("il Coach crea una tappa di prova giocata fino alla finale, con una sola POST della tappa", async ({ page }) => {
  // Quattro squadre con quattro giocatori ciascuna: il minimo che lo strumento accetta (MIN_ROSTER) senza tagliare nessuno
  const nomi = ["Alfa", "Beta", "Gamma", "Delta"];
  const giocatori = nomi.flatMap((_, s) => [0, 1, 2, 3].map((g) => giocatoreDiAnna(`p${s}${g}`, `Giocatore ${s}${g}`, `Cognome${s}${g}`)));
  const squadre = nomi.map((nome, s) => ({ ...squadraDiAnna(`s${s}`, nome), roster: [0, 1, 2, 3].map((g) => `p${s}${g}`) }));

  // Nessuna chiamata che non sia prevista da questo test (né al backend né al modello) deve passare
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await utenteRegistrato(page, { giocatori, squadre }); // sessione di Anna, anagrafe e leghe vuote
  // Lega attiva «Circuito», senza tappe: la tappa di prova la crea il Coach
  await page.addInitScript(() => localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1"));
  await page.route("**/api/leghe", (route) => route.fulfill(json([{ id: "l1", nome: "Circuito", ts: 1, nTappe: 0 }])));

  // Le richieste alla lega: la lettura della lega, e la POST che crea la tappa (l'unico invio atteso)
  const postate: TappaInviata[] = [];
  const modifiche: string[] = [];
  await page.route("**/api/leghe/**", (route) => {
    const richiesta = route.request();
    if (richiesta.method() === "POST") {
      const tappa = richiesta.postDataJSON();
      postate.push(tappa);
      return route.fulfill(creato({ ...tappa, versione: 1 }));
    }
    return route.fulfill(json({ id: "l1", nome: "Circuito", tappe: [] }));
  });
  // Una PUT o una DELETE su una tappa vorrebbe dire salvataggi in coda: non ce ne devono essere
  await page.route("**/api/tappe/**", (route) => {
    modifiche.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.fulfill(json({}));
  });

  // Il modello finto: alla prima richiesta chiede lo strumento, alla seconda risponde con un testo
  let chiamateCoach = 0;
  await page.route("**/api/coach/chat", (route) => {
    chiamateCoach++;
    if (chiamateCoach > 1) {
      return route.fulfill(json({ choices: [{ message: { role: "assistant", content: "Ho creato la tappa di prova." } }] }));
    }
    const chiamata = { id: "1", type: "function", function: { name: "crea_tappa_simulata", arguments: JSON.stringify({ nome: "Demo", nSquadre: 4 }) } };
    return route.fulfill(json({ choices: [{ message: { role: "assistant", content: null, tool_calls: [chiamata] } }] }));
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Apri Coach AI" }).click();
  await page.getByLabel("Messaggio per il coach").fill("creami una tappa di prova");
  await page.getByRole("button", { name: "Invia" }).click();

  // Nel pannello: l'azione eseguita e la risposta finale del modello
  const pannello = page.getByRole("dialog", { name: "Coach AI" });
  await expect(pannello.getByText("Tappa simulata", { exact: true })).toBeVisible();
  await expect(pannello.getByText("Ho creato la tappa di prova.")).toBeVisible();

  // Il Coach porta alla pagina della tappa: finale giocata, quindi c'è il campione
  await expect(page).toHaveURL(/\/lega\/tappa\//);
  await expect(page.getByText("Campione", { exact: true })).toBeVisible();

  // Una richiesta, una POST: la tappa arriva intera. La coda dei salvataggi parte dopo 400 ms, quindi si aspetta la POST e poi un
  // po' di più, per vedere un eventuale secondo invio (una PUT o una POST in più) che non deve esserci
  await expect.poll(() => postate.length).toBe(1);
  await page.waitForTimeout(800);
  expect(postate).toHaveLength(1);
  expect(modifiche).toEqual([]);
  // Tutte le gare sono giocate: la pagina della tappa non ha un conteggio, lo scrive la dashboard («N/N gare giocate»)
  const tappa = postate[0];
  const totale = tappa.partite.length + tappa.bracket.filter((m) => !m.bye).length;
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Home" }).click();
  await expect(page.getByText(`${totale}/${totale} gare giocate`)).toBeVisible();

  expect(nonPreviste).toEqual([]);
});
