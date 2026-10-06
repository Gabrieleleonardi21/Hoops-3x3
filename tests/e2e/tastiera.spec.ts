import { test, expect, type Locator, type Page } from "@playwright/test";
import { giocatoreDiAnna, json, ospiteConLega, squadraDiAnna, tabFinoA, utenteRegistrato } from "./helpers";

// Percorsi fatti con la sola tastiera (Tab, Maiusc+Tab, Invio, Spazio, Esc): il mouse non si usa mai dopo l'apertura della pagina.
// Nessuna chiamata al backend vero: le risposte le decide il test.

/** true se il focus è dentro `finestra` */
const focusDentro = (finestra: Locator) => finestra.evaluate((el) => el.contains(document.activeElement));

/** Preme `tasto` `volte` volte e, dopo ognuna, controlla che il focus sia ancora dentro `finestra` e mai sulle card della pagina sotto */
async function giraDentro(page: Page, finestra: Locator, tasto: "Tab" | "Shift+Tab", volte: number) {
  for (let i = 0; i < volte; i++) {
    await page.keyboard.press(tasto);
    expect(await focusDentro(finestra), `${tasto} n. ${i + 1}: il focus è uscito dalla finestra`).toBe(true);
  }
}

test("anagrafe: scheda, poi conferma; Tab non esce dalla conferma e Esc chiude una finestra alla volta, con il focus che torna indietro", async ({ page }) => {
  await utenteRegistrato(page, { giocatori: [giocatoreDiAnna("g1", "Mario", "Rossi"), giocatoreDiAnna("g2", "Luigi", "Bianchi")] });
  await page.goto("/anagrafe");

  // Con Tab fino al nome di Mario, poi Invio: si apre la scheda
  const nomeMario = page.getByRole("button", { name: "Mario Rossi", exact: true });
  await tabFinoA(page, nomeMario);
  await page.keyboard.press("Enter");
  const scheda = page.getByRole("dialog", { name: "Scheda giocatore Mario Rossi" });
  // Il focus è entrato nella scheda, sul primo elemento del contenuto
  await expect(scheda.getByRole("link", { name: /Profilo e statistiche/ })).toBeFocused();

  // Con Tab fino a «Elimina», poi Invio: si apre la conferma sopra la scheda, con il focus sul pulsante più sicuro
  await tabFinoA(page, scheda.getByRole("button", { name: "Elimina" }));
  await page.keyboard.press("Enter");
  const conferma = page.getByRole("dialog", { name: "Eliminare il giocatore?" });
  await expect(conferma.getByRole("button", { name: "Annulla" })).toBeFocused();

  // Tab e Maiusc+Tab, molte più volte dei pulsanti che ci sono: il focus gira nella conferma. Non arriva mai né alla scheda sotto né
  // alla X di un'altra card («Elimina Luigi Bianchi»), che aprirebbe una seconda conferma sopra la prima
  await giraDentro(page, conferma, "Tab", 8);
  await giraDentro(page, conferma, "Shift+Tab", 8);
  await expect(page.getByRole("button", { name: "Elimina Luigi Bianchi", exact: true })).not.toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(2); // la scheda e la conferma, non una terza

  // Esc chiude solo la conferma, e il focus torna a «Elimina» della scheda
  await page.keyboard.press("Escape");
  await expect(conferma).toHaveCount(0);
  await expect(scheda).toBeVisible();
  await expect(scheda.getByRole("button", { name: "Elimina" })).toBeFocused();

  // Il secondo Esc chiude la scheda, e il focus torna al nome di Mario nella pagina
  await page.keyboard.press("Escape");
  await expect(scheda).toHaveCount(0);
  await expect(nomeMario).toBeFocused();
});

test("anagrafe: la X di una card apre la conferma; Annulla la chiude e il focus torna alla X", async ({ page }) => {
  await utenteRegistrato(page, { giocatori: [giocatoreDiAnna("g1", "Mario", "Rossi"), giocatoreDiAnna("g2", "Luigi", "Bianchi")] });
  await page.goto("/anagrafe");
  const xLuigi = page.getByRole("button", { name: "Elimina Luigi Bianchi", exact: true });
  await tabFinoA(page, xLuigi);
  await page.keyboard.press("Enter");
  const conferma = page.getByRole("dialog", { name: "Eliminare il giocatore?" });
  await expect(conferma.getByRole("button", { name: "Annulla" })).toBeFocused();
  await giraDentro(page, conferma, "Tab", 6);
  await page.keyboard.press("Escape");
  await expect(conferma).toHaveCount(0);
  await expect(xLuigi).toBeFocused();
});

test("timer: il focus entra su START, Esc con la partita in corso chiede conferma, e alla fine il focus torna al pulsante «Timer»", async ({ page }) => {
  await page.route("**/api/anagrafe/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ospiteConLega(page);
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  const apriTimer = page.getByRole("button", { name: "Timer", exact: true });
  await apriTimer.focus();
  await page.keyboard.press("Enter");

  // START ha il focus: Spazio avvia il cronometro, che non è un punto dato per sbaglio a una squadra
  const timer = page.getByRole("dialog", { name: "Timer di gara" });
  await expect(timer.getByRole("button", { name: "START" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(timer.getByRole("button", { name: "STOP" })).toBeFocused(); // è lo stesso pulsante

  // Con la partita in corso Esc chiede conferma, con il focus su «Annulla»; Tab non esce dalla conferma
  await page.keyboard.press("Escape");
  const conferma = page.getByRole("dialog", { name: "Chiudere il timer?" });
  await expect(conferma.getByRole("button", { name: "Annulla" })).toBeFocused();
  await giraDentro(page, conferma, "Tab", 6);
  await giraDentro(page, conferma, "Shift+Tab", 6);

  // Esc annulla la conferma: il timer resta, e il focus torna al pulsante da cui si era partiti
  await page.keyboard.press("Escape");
  await expect(conferma).toHaveCount(0);
  await expect(timer.getByRole("button", { name: "STOP" })).toBeFocused();

  // Di nuovo Esc, poi «Conferma» con Invio: il timer si chiude e il focus torna a «Timer» nella pagina
  await page.keyboard.press("Escape");
  await tabFinoA(page, conferma.getByRole("button", { name: "Conferma" }));
  await page.keyboard.press("Enter");
  await expect(timer).toHaveCount(0);
  await expect(apriTimer).toBeFocused();
});

test("Coach: Esc chiude il pannello solo se nessuna finestra gli sta sopra", async ({ page }) => {
  await utenteRegistrato(page, { giocatori: [giocatoreDiAnna("g1", "Mario", "Rossi")] });
  await page.goto("/anagrafe");
  const pannello = page.getByRole("dialog", { name: "Coach AI" });

  // Il pannello si apre con il pulsante del Coach, il focus va nel campo per scrivere; Esc lo chiude e il focus torna al pulsante
  const pulsante = page.getByRole("button", { name: "Apri Coach AI" });
  await pulsante.focus();
  await page.keyboard.press("Enter");
  await expect(pannello).toBeVisible();
  await expect(pannello.getByRole("textbox", { name: "Messaggio per il coach" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pannello).toHaveCount(0);
  await expect(pulsante).toBeFocused();

  // Riaperto, con la scheda di Mario aperta sopra: Esc chiude la scheda e il pannello resta; il secondo Esc chiude il pannello
  await page.getByRole("button", { name: "Apri Coach AI" }).focus();
  await page.keyboard.press("Enter");
  await expect(pannello).toBeVisible();
  await tabFinoA(page, page.getByRole("button", { name: "Mario Rossi", exact: true }));
  await page.keyboard.press("Enter");
  const scheda = page.getByRole("dialog", { name: "Scheda giocatore Mario Rossi" });
  await expect(scheda).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(scheda).toHaveCount(0);
  await expect(pannello).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pannello).toHaveCount(0);
});

test("archivio: la squadra è un pulsante vero; Invio e Spazio aprono la scheda, Esc la chiude e il focus torna alla card", async ({ page }) => {
  // Pagina pubblica di una tappa conclusa: si vede anche senza accedere
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const squadra = (sid: string, nome: string) => ({ id: sid, nome, giocatori: [{ id: `${sid}-1`, nome: "Mario" }], rank: "" });
  await page.route(`**/api/archivio/${id}`, (route) => route.fulfill(json({
    tappa: {
      id, nome: "Tappa pubblica", luogo: "Roma", data: "2026-10-01", nGironi: 1, regole: { target: 21, durata: 10, ot: 2, shot: 12 },
      squadre: [squadra("s1", "Alfa"), squadra("s2", "Beta")], gironi: [["s1", "s2"]],
      partite: [{ id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true }], video: [], conclusa: true,
    },
    lega: "Estate", autore: "Anna", autoreId: "u1", ts: 1,
  })));
  await page.goto(`/tappa/${id}`);

  // Il nome del pulsante è il suo contenuto: «3×3» (il segnaposto del logo), «Alfa» e «1 giocatori»
  const alfa = page.getByRole("button", { name: /Alfa/ });
  expect(await alfa.evaluate((el) => el.tagName)).toBe("BUTTON"); // non un div con role=button
  await tabFinoA(page, alfa);
  const scheda = page.getByRole("dialog", { name: "Scheda squadra Alfa" });
  for (const tasto of ["Enter", "Space"]) {
    await page.keyboard.press(tasto);
    await expect(scheda).toBeVisible();
    expect(await focusDentro(scheda)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(scheda).toHaveCount(0);
    await expect(alfa).toBeFocused();
  }
});

test("scheda: «Modifica» porta il focus sul primo campo del form, per il giocatore e per la squadra", async ({ page }) => {
  await utenteRegistrato(page, { giocatori: [giocatoreDiAnna("g1", "Mario", "Rossi")], squadre: [squadraDiAnna("s1", "Ballers")] });
  await page.goto("/anagrafe");

  // Giocatore: il pulsante «Modifica» sparisce con la vista dei dati, e il focus non cade su body ma sul campo «Nome»
  await tabFinoA(page, page.getByRole("button", { name: "Mario Rossi", exact: true }));
  await page.keyboard.press("Enter");
  const schedaGiocatore = page.getByRole("dialog", { name: "Scheda giocatore Mario Rossi" });
  await tabFinoA(page, schedaGiocatore.getByRole("button", { name: "Modifica" }));
  await page.keyboard.press("Enter");
  await expect(schedaGiocatore.getByLabel("Nome", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(schedaGiocatore).toHaveCount(0);

  // Squadra: la scheda «Squadre» con Tab e Invio, poi lo stesso percorso, e il focus va a «Nome squadra»
  await tabFinoA(page, page.getByRole("tab", { name: /Squadre/ }));
  await page.keyboard.press("Enter");
  await tabFinoA(page, page.getByRole("button", { name: "Ballers", exact: true }));
  await page.keyboard.press("Enter");
  const schedaSquadra = page.getByRole("dialog", { name: "Scheda squadra Ballers" });
  await tabFinoA(page, schedaSquadra.getByRole("button", { name: "Modifica" }));
  await page.keyboard.press("Enter");
  await expect(schedaSquadra.getByLabel("Nome squadra", { exact: true })).toBeFocused();
});

test("timer: a partita decisa il focus passa all'esito, che il lettore di schermo annuncia", async ({ page }) => {
  await page.route("**/api/anagrafe/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ospiteConLega(page);
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByLabel("Punteggio vittoria").fill("3"); // bastano due canestri da 2
  await page.getByRole("button", { name: "Timer", exact: true }).focus();
  await page.keyboard.press("Enter");
  const timer = page.getByRole("dialog", { name: "Timer di gara" });

  // Con Tab fino a «+2 a Squadra A» e due Invio: 4 punti, la squadra A ha vinto
  await tabFinoA(page, timer.getByRole("button", { name: "+2 a Squadra A" }));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const esito = timer.getByRole("status");
  await expect(esito).toHaveText("Squadra A — Partita conclusa");
  await expect(esito).toBeFocused();
});
