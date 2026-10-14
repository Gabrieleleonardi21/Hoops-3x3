import { test, expect } from "@playwright/test";
import { registraUtenteNuovo, rispostaA } from "./helpers";

/* «Importa file» con una foto sul server vero, senza lettore configurato (AI_LETTORE_FOGLIO vuota in playwright.backend.config.ts):
 * il contratto del 503 di POST /api/coach/foglio, con il suo messaggio nella pagina. Nessun fornitore viene chiamato. */

test("senza lettore configurato una foto riceve il 503 del server, il messaggio compare nella pagina e nessuna lega nasce", async ({ page }) => {
  await registraUtenteNuovo(page);
  await page.getByLabel(/Nome della nuova lega/i).fill("Circuito Roma");
  await page.getByRole("button", { name: /Crea lega/i }).click();
  await expect(page).toHaveURL(/\/lega$/);

  const lettura = rispostaA(page, "POST", /^\/api\/coach\/foglio$/);
  await page.locator("input[type=file]").setInputFiles("tests/e2e/fixtures/foglio.jpg");
  const risposta = await lettura;
  expect(risposta.status()).toBe(503);
  // La foto è arrivata ridotta, come data URL JPEG: il server l'ha accettata nella forma e si è fermato sul lettore mancante
  expect(risposta.request().postDataJSON().immagine).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByRole("alert")).toHaveText(
    "Import non riuscito: Foto «foglio.jpg»: Lettura dei fogli non configurata sul server (AI_LETTORE_FOGLIO)",
  );
  // La lega aperta resta quella di prima, e la pagina è usabile
  await expect(page.getByLabel(/La tua lega/i)).toHaveValue("Circuito Roma");
  await expect(page.getByRole("button", { name: /Importa file/ })).toBeEnabled();
});
