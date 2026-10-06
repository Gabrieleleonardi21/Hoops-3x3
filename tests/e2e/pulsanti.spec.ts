import { test, expect } from "@playwright/test";
import { ospiteConLega } from "./helpers";

// Come ospite: tutto resta nel browser. La pagina della tappa scarica l'anagrafe, la cui risposta la decide il test (il backend non c'è)
test.beforeEach(async ({ page }) => {
  await page.route("**/api/anagrafe/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
});

// I colori che il browser calcola per i token di src/index.css: chalk-muted #a9a398, chalk-dim #8c8780, court #ff6a1f
const CHALK_MUTED = "rgb(169, 163, 152)";
const CHALK_DIM = "rgb(140, 135, 128)";

/** Una tappa con 4 squadre in 2 gironi (una partita per girone): bastano due risultati per arrivare al tabellone */
async function tappaConDuePartite(page: import("@playwright/test").Page) {
  await ospiteConLega(page);
  await page.getByLabel("Numero squadre").fill("4");
  await page.getByLabel("Numero gironi").fill("2");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
}

/** Scrive il risultato della prima partita ancora aperta e lo salva */
async function salvaPrimaPartitaAperta(page: import("@playwright/test").Page) {
  await page.locator("input.scorein").nth(0).fill("21");
  await page.locator("input.scorein").nth(1).fill("15");
  await page.getByRole("button", { name: /Salva risultato/i }).first().click();
}

test("i collegamenti attenuati restano attenuati nel CSS vero: Correggi, Reset tutto, Elimina bracket e ricomincia, Rimuovi squadra (FU-2)", async ({ page }) => {
  await tappaConDuePartite(page);

  // «Rimuovi squadra» è un collegamento grigio scuro (text-chalk-dim), non arancione (text-court della variante)
  await expect(page.getByRole("button", { name: "Rimuovi squadra" }).first()).toHaveCSS("color", CHALK_DIM);

  // «Correggi» compare a partita salvata
  await salvaPrimaPartitaAperta(page);
  await expect(page.getByRole("button", { name: "Correggi" })).toHaveCSS("color", CHALK_MUTED);

  // «Reset tutto» sta nel timer
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const timer = page.getByRole("dialog", { name: "Timer di gara" });
  await expect(timer.getByRole("button", { name: "Reset tutto" })).toHaveCSS("color", CHALK_MUTED);
  await page.keyboard.press("Escape"); // 0 a 0 e cronometro fermo: niente da perdere, si chiude subito
  await expect(timer).toHaveCount(0);

  // «Elimina bracket e ricomincia» compare con il tabellone, a gironi finiti
  await salvaPrimaPartitaAperta(page);
  await page.getByRole("button", { name: /Genera bracket/i }).click();
  await expect(page.getByRole("button", { name: "Elimina bracket e ricomincia" })).toHaveCSS("color", CHALK_MUTED);

  // Il collegamento che deve restare arancione lo resta: «Statistiche complete» non passa un colore e tiene quello della variante
  await expect(page.getByRole("button", { name: /Eventi di gara/ }).first()).toHaveCSS("color", "rgb(255, 106, 31)");
});

test("i pulsanti del timer prendono padding e grandezza del testo che l'esterno passa (px-4, text-xl, h-12, px-8)", async ({ page }) => {
  await tappaConDuePartite(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const timer = page.getByRole("dialog", { name: "Timer di gara" });

  // «+1»: px-4 (16 px) e text-xl (20 px), non i px-5 (20 px) e text-[15px] della misura
  const piuUno = timer.getByRole("button", { name: /^\+1/ }).first();
  await expect(piuUno).toHaveCSS("padding-left", "16px");
  await expect(piuUno).toHaveCSS("padding-right", "16px");
  await expect(piuUno).toHaveCSS("font-size", "20px");
  await expect(piuUno).toHaveCSS("height", "44px");

  // START: h-12 (48 px), px-8 (32 px), text-xl; quando corre diventa STOP con lo sfondo rosso (bg-loss) al posto dell'arancione
  const start = timer.getByRole("button", { name: "START" });
  await expect(start).toHaveCSS("height", "48px");
  await expect(start).toHaveCSS("padding-left", "32px");
  await expect(start).toHaveCSS("background-color", "rgb(255, 106, 31)");
  await start.click();
  await expect(timer.getByRole("button", { name: "STOP" })).toHaveCSS("background-color", "rgb(255, 77, 77)");
  await timer.getByRole("button", { name: "STOP" }).click();
});
