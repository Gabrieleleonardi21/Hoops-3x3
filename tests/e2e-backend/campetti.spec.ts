import { test, expect, type Page } from "@playwright/test";
import { registraUtenteNuovo, rispostaA } from "./helpers";

/* I campetti sul server vero (T5.5): è il percorso di tests/e2e/campetti.spec.ts (server finto) con le risposte del backend. Qui si
 * fissa il contratto che il server finto imita: la POST risponde 201 con versione 0, tipo «campetto» e l'autore del token; la PUT 200 con
 * la versione aumentata di uno; la DELETE 204; e dopo un ricaricamento la pagina rilegge dal server ciò che è stato salvato. Il nome
 * porta l'istante, perché i test condividono il database e non lo svuotano (il campetto si elimina alla fine). */

/** Apre i Campetti dal menu e aspetta la pagina */
async function apriCampetti(page: Page) {
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Campetti" }).click();
  await expect(page.getByRole("heading", { name: "Campetti" })).toBeVisible();
}

test("un campetto nasce sul server (201, versione 0), resta dopo un ricaricamento, si modifica (PUT, versione 1) e si elimina (204)", async ({ page }) => {
  await registraUtenteNuovo(page);
  await apriCampetti(page);
  const nome = `Campo e2e ${Date.now()}`;

  // Creazione: coordinate scritte a mano, dentro i 20 km da Roma con cui la pagina si apre, così il campetto torna nella lettura
  await page.getByRole("button", { name: /Aggiungi un campetto/ }).click();
  const finestra = page.getByRole("dialog", { name: "Nuovo campetto" });
  await finestra.getByLabel("Nome *").fill(nome);
  await finestra.getByLabel("Città").fill("Roma");
  await finestra.getByLabel("Latitudine").fill("41.9");
  await finestra.getByLabel("Longitudine").fill("12.5");
  await finestra.getByLabel("Retine").check();
  const post = rispostaA(page, "POST", /^\/api\/campetti$/);
  await finestra.getByRole("button", { name: "Salva il campetto" }).click();
  const creata = await post;
  expect(creata.status()).toBe(201);
  const corpoCreata = await creata.json();
  expect(corpoCreata).toMatchObject({ nome, citta: "Roma", lat: 41.9, lng: 12.5, retine: true, tipo: "campetto", versione: 0 });
  expect(typeof corpoCreata.autoreId).toBe("string"); // con il token l'autore si vede: è chi può modificare
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = () => page.getByRole("article", { name: nome });
  await expect(card()).toBeVisible();
  await expect(card().getByText("Retine")).toBeVisible();

  // Dopo un ricaricamento l'app rilegge dal server: il campetto c'è, con i comandi di chi l'ha scritto
  await page.reload();
  await expect(card()).toBeVisible();
  await expect(page.getByRole("button", { name: `Modifica ${nome}` })).toBeVisible();

  // Modifica: la PUT manda la versione letta (0) e il server risponde con la 1
  await page.getByRole("button", { name: `Modifica ${nome}` }).click();
  const modifica = page.getByRole("dialog", { name: `Modifica campetto ${nome}` });
  await expect(modifica.getByLabel("Nome *")).toHaveValue(nome);
  await modifica.getByLabel("Nome *").fill(`${nome} bis`);
  await modifica.getByLabel("Stato del campo").selectOption("discreto");
  const put = rispostaA(page, "PUT", /^\/api\/campetti\/[^/]+$/);
  await modifica.getByRole("button", { name: "Salva il campetto" }).click();
  const salvata = await put;
  expect(salvata.status()).toBe(200);
  expect(salvata.request().postDataJSON()).toMatchObject({ nome: `${nome} bis`, stato: "discreto", versione: 0 });
  expect(await salvata.json()).toMatchObject({ id: corpoCreata.id, nome: `${nome} bis`, stato: "discreto", versione: 1 });
  const cardBis = () => page.getByRole("article", { name: `${nome} bis` });
  await expect(cardBis()).toBeVisible();
  await expect(cardBis().getByText("Stato: discreto")).toBeVisible();
  await page.reload();
  await expect(cardBis()).toBeVisible();

  // Eliminazione, con la conferma: 204 e il campetto non torna nemmeno dopo un ricaricamento
  await page.getByRole("button", { name: `Elimina ${nome} bis` }).click();
  const del = rispostaA(page, "DELETE", /^\/api\/campetti\/[^/]+$/);
  await page.getByRole("alertdialog", { name: "Eliminare il campetto?" }).getByRole("button", { name: "Conferma" }).click();
  expect((await del).status()).toBe(204);
  await expect(cardBis()).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Campetti" })).toBeVisible();
  await expect(page.getByText(/campett[oi] · intorno a Roma/)).toBeVisible();
  await expect(cardBis()).toHaveCount(0);
});
