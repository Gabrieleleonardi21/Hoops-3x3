import { test, expect, type Page } from "@playwright/test";

/** Il browser di un ospite che anni fa importò una tappa incompleta: la lega «Estate» ha una tappa buona e una a cui manca
 *  l'elenco delle squadre. Si scrive nel localStorage dopo aver aperto la pagina, poi si ricarica come farebbe l'utente. */
async function browserConTappaIncompleta(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const buona = {
      id: "t-buona", nome: "Tappa buona", luogo: "", data: "", nGironi: 1, regole: { target: 21, durata: 10, ot: 2, shot: 12 },
      squadre: [{ id: "s1", nome: "Uno", giocatori: [], rank: "" }, { id: "s2", nome: "Due", giocatori: [], rank: "" }],
      gironi: null, partite: [], video: [],
    };
    const rotta = { id: "t-rotta", nome: "Tappa rotta", luogo: "", data: "", nGironi: 1, gironi: null, partite: [], video: [] };
    localStorage.setItem("hoop3x3_session", JSON.stringify({ name: "Ospite", guest: true }));
    localStorage.setItem("hoop3x3_leghe_index", JSON.stringify([{ id: "l1", nome: "Estate", ts: 1, nTappe: 2 }]));
    localStorage.setItem("hoop3x3_active_lega_id", "l1");
    localStorage.setItem("hoop3x3_lega_l1", JSON.stringify({ nome: "Estate", tappe: [buona, rotta] }));
  });
  await page.reload();
}

test("una tappa incompleta nel browser dell'ospite: niente pagina bianca, un messaggio, il resto si usa anche dopo il ricaricamento", async ({ page }) => {
  await browserConTappaIncompleta(page);
  // La tappa buona si vede; il messaggio dice quale tappa non è stata caricata e perché
  await expect(page.getByRole("heading", { name: "Tappa buona" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("«Tappa rotta» (manca il campo «squadre»)");
  await expect(page.getByText("Qualcosa è andato storto")).toHaveCount(0);

  // Il resto è usabile: si va alle leghe e la lega si apre
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Le mie leghe" }).click();
  await expect(page.getByRole("heading", { name: /Le mie leghe/ })).toBeVisible();
  await page.getByRole("button", { name: "Apri", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Le tappe del circuito" })).toBeVisible();
  await expect(page.getByText("Tappa buona")).toBeVisible();

  // Ricaricando i dati nel browser non sono cambiati: l'app si disegna ancora, con lo stesso messaggio
  await page.reload();
  await expect(page.getByRole("heading", { name: "Le tappe del circuito" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Tappa rotta");

  // Al primo salvataggio la tappa scartata sparisce dal browser, e il messaggio non torna più
  await page.getByLabel(/La tua lega/).fill("Estate 2025");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Le tappe del circuito" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Tappa buona")).toBeVisible();
});

test("una lega illeggibile nel browser dell'ospite non si apre: il messaggio dice di eliminarla, e l'elenco lo permette", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("hoop3x3_session", JSON.stringify({ name: "Ospite", guest: true }));
    localStorage.setItem("hoop3x3_leghe_index", JSON.stringify([{ id: "l1", nome: "Estate", ts: 1, nTappe: 2 }]));
    localStorage.setItem("hoop3x3_active_lega_id", "l1");
    localStorage.setItem("hoop3x3_lega_l1", "{ non json");
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("I dati della lega «Estate» non ci sono più nel browser o sono danneggiati");
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Le mie leghe" }).click();
  await page.getByRole("button", { name: "Apri", exact: true }).click();
  // L'avviso di avvio sta nella barra sotto l'intestazione; quello dell'apertura nella pagina
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Apertura non riuscita");
  // La via d'uscita: eliminare la lega rovinata (la conferma del browser si accetta)
  page.once("dialog", (finestra) => { void finestra.accept(); });
  await page.getByRole("button", { name: "Elimina lega Estate" }).click();
  await expect(page.getByText(/Nessuna lega ancora/)).toBeVisible();
});
