import { test, expect, type Locator } from "@playwright/test";
import { giocatoreDiAnna, ospiteConLega, salvaPrimaPartitaAperta, tappaConDuePartite, utenteRegistrato } from "./helpers";

// docs/design-system.md: «touch target ≥ 44px su mobile». I pulsanti con la sola icona e quelli piccoli arrivano a 44×44 px di area di
// tocco su telefono (sotto i 640 px, dove l'app passa alla disposizione per mobile); l'icona e il testo restano della grandezza di prima.
// Nessuna chiamata al backend vero: le risposte le decide il test.

const TELEFONO = { width: 390, height: 844 };
const MINIMO = 44;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/anagrafe/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
});

/** Le misure del pulsante: larghezza e altezza della sua area di tocco, in pixel */
async function misure(pulsante: Locator) {
  const box = await pulsante.boundingBox();
  expect(box, `${pulsante} non si vede`).not.toBeNull();
  return { larghezza: box!.width, altezza: box!.height };
}

/** Il pulsante ha un'area di tocco di almeno 44×44 px (le asserzioni sono «soft»: un test dice tutti i pulsanti troppo piccoli) */
async function almeno44(pulsante: Locator, nome: string) {
  const { larghezza, altezza } = await misure(pulsante);
  expect.soft(larghezza, `${nome}: larghezza`).toBeGreaterThanOrEqual(MINIMO);
  expect.soft(altezza, `${nome}: altezza`).toBeGreaterThanOrEqual(MINIMO);
}

test.describe("a 390 px di larghezza", () => {
  test.use({ viewport: TELEFONO });

  test("elenco delle leghe e finestra di conferma: cestino, «Apri», X della finestra, «Annulla» e «Conferma»", async ({ page }) => {
    await ospiteConLega(page);
    await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Le mie leghe" }).click();
    await almeno44(page.getByRole("button", { name: "Elimina lega Lega di prova" }), "cestino della lega (icona 16 px)");
    await almeno44(page.getByRole("button", { name: "Apri", exact: true }), "«Apri» (pulsante piccolo)");

    await page.getByRole("button", { name: "Elimina lega Lega di prova" }).click();
    const conferma = page.getByRole("dialog", { name: "Eliminare la lega?" });
    await almeno44(conferma.getByRole("button", { name: "Chiudi" }), "X della finestra (icona 20 px)");
    await almeno44(conferma.getByRole("button", { name: "Annulla" }), "«Annulla»");
    await almeno44(conferma.getByRole("button", { name: "Conferma" }), "«Conferma»");
  });

  test("pagina della tappa e timer: collegamenti, X del roster, pulsante piccolo, punti e comandi del timer", async ({ page }) => {
    await tappaConDuePartite(page);
    await almeno44(page.getByRole("button", { name: "Rimuovi squadra" }).first(), "«Rimuovi squadra» (collegamento)");
    // Le squadre nuove non hanno giocatori: se ne aggiunge uno, e compare la sua X
    const aggiungi = page.getByRole("button", { name: /Aggiungi giocatore/ }).first();
    await almeno44(aggiungi, "«Aggiungi giocatore» (collegamento con icona)");
    await aggiungi.click();
    await almeno44(page.getByRole("button", { name: "Rimuovi giocatore" }).first(), "X del roster (icona 14 px)");
    await almeno44(page.getByRole("button", { name: "Salva risultato" }).first(), "«Salva risultato» (pulsante piccolo)");
    await salvaPrimaPartitaAperta(page);
    await almeno44(page.getByRole("button", { name: "Correggi" }), "«Correggi» (collegamento)");

    await page.getByRole("button", { name: "Timer", exact: true }).click();
    const timer = page.getByRole("dialog", { name: "Timer di gara" });
    await almeno44(timer.getByRole("button", { name: "Chiudi" }), "X del timer");
    await almeno44(timer.getByRole("button", { name: "+1 a Squadra A" }), "«+1»");
    await almeno44(timer.getByRole("button", { name: "Togli un punto a Squadra A" }), "«−» (icona 16 px)");
    await almeno44(timer.getByRole("button", { name: "START" }), "START");
    await almeno44(timer.getByRole("button", { name: "Reset tutto" }), "«Reset tutto» (collegamento)");
    await almeno44(timer.getByRole("button", { name: /^Reset \d+s$/ }), "«Reset 12s» (collegamento)");
  });

  test("anagrafe e Coach: X delle card, scheda, pannello del Coach", async ({ page }) => {
    await utenteRegistrato(page, { giocatori: [giocatoreDiAnna("g1", "Mario", "Rossi")] });
    await page.goto("/anagrafe");
    await almeno44(page.getByRole("button", { name: "Elimina Mario Rossi" }), "X della card (icona 14 px)");

    await page.getByRole("button", { name: "Mario Rossi", exact: true }).click();
    const scheda = page.getByRole("dialog", { name: "Scheda giocatore Mario Rossi" });
    await almeno44(scheda.getByRole("button", { name: "Chiudi" }), "X della scheda");
    await almeno44(scheda.getByRole("button", { name: "Modifica" }), "«Modifica» (pulsante piccolo)");
    await almeno44(scheda.getByRole("button", { name: "Elimina" }), "«Elimina» (pulsante piccolo)");
    await page.keyboard.press("Escape");

    await almeno44(page.getByRole("button", { name: "Apri Coach AI" }), "pulsante del Coach");
    await page.getByRole("button", { name: "Apri Coach AI" }).click();
    const pannello = page.getByRole("dialog", { name: "Coach AI" });
    await almeno44(pannello.getByRole("button", { name: "Chiudi" }), "X del pannello del Coach (icona 18 px)");
    await almeno44(pannello.getByRole("button", { name: "Invia" }), "«Invia»");
  });
});

test.describe("su desktop (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("l'aspetto non cambia: la X di una card resta piccola, come l'icona", async ({ page }) => {
    await utenteRegistrato(page, { giocatori: [giocatoreDiAnna("g1", "Mario", "Rossi")] });
    await page.goto("/anagrafe");
    const { larghezza, altezza } = await misure(page.getByRole("button", { name: "Elimina Mario Rossi" }));
    expect(larghezza).toBeLessThan(MINIMO);
    expect(altezza).toBeLessThan(MINIMO);
  });
});
