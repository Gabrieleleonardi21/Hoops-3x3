import { test, expect } from "@playwright/test";
import { ospiteConLega } from "./helpers";

// Come ospite: tutto resta nel browser, nessuna chiamata al backend. Le eliminazioni chiedono conferma con la finestra dell'app.

// La pagina della tappa scarica l'anagrafe (in sola lettura anche per l'ospite): la risposta la decide il test, il backend non c'è
test.beforeEach(async ({ page }) => {
  await page.route("**/api/anagrafe/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
});

test("«Elimina» su una tappa apre la conferma: «Annulla» non cambia niente, «Conferma» elimina", async ({ page }) => {
  await ospiteConLega(page);
  await page.getByLabel(/Nome tappa/i).fill("Tappa da eliminare");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await expect(page).toHaveURL(/\/lega\/tappa\//);

  // Una tappa con un sorteggio e un risultato registrato: la finestra deve dirlo, con i numeri veri
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
  await page.locator("input.scorein").nth(0).fill("21");
  await page.locator("input.scorein").nth(1).fill("15");
  await page.getByRole("button", { name: /Salva risultato/i }).first().click();

  const elimina = page.getByRole("button", { name: "Elimina", exact: true });
  await elimina.click();
  const finestra = page.getByRole("alertdialog", { name: "Eliminare la tappa?" });
  await expect(finestra).toContainText("Verranno eliminati la tappa «Tappa da eliminare» con 8 squadre, il sorteggio e 1 risultato.");

  // «Annulla»: la finestra si chiude e la tappa è ancora lì, sorteggio e risultato compresi (anche dopo il ricaricamento)
  await finestra.getByRole("button", { name: "Annulla" }).click();
  await expect(finestra).toHaveCount(0);
  await expect(page).toHaveURL(/\/lega\/tappa\//);
  await expect(page.getByRole("heading", { name: "Tappa da eliminare" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Girone A" })).toBeVisible();

  // «Conferma»: la tappa si elimina e si torna all'elenco, che non la mostra più
  await elimina.click();
  await page.getByRole("alertdialog", { name: "Eliminare la tappa?" }).getByRole("button", { name: "Conferma" }).click();
  await expect(page).toHaveURL(/\/lega$/);
  await expect(page.getByText(/Nessuna tappa in calendario/)).toBeVisible();
  await expect(page.getByText("Tappa da eliminare")).toHaveCount(0);
});

test("«Elimina lega» chiede conferma con la finestra dell'app, non con quella del browser", async ({ page }) => {
  // I dialoghi del browser (window.confirm) si annotano e si chiudono: l'app non deve più usarli
  const dialoghiDelBrowser: string[] = [];
  page.on("dialog", (dialogo) => { dialoghiDelBrowser.push(dialogo.message()); void dialogo.dismiss(); });
  await ospiteConLega(page, "Lega da eliminare");
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Le mie leghe" }).click();

  await page.getByRole("button", { name: "Elimina lega Lega da eliminare" }).click();
  const finestra = page.getByRole("alertdialog", { name: "Eliminare la lega?" });
  await expect(finestra).toContainText("Verrà eliminata la lega «Lega da eliminare», che non ha tappe.");

  // «Annulla»: la lega resta nell'elenco
  await finestra.getByRole("button", { name: "Annulla" }).click();
  await expect(finestra).toHaveCount(0);
  await expect(page.getByText("Lega da eliminare", { exact: true })).toBeVisible();

  // «Conferma»: la lega sparisce
  await page.getByRole("button", { name: "Elimina lega Lega da eliminare" }).click();
  await page.getByRole("alertdialog", { name: "Eliminare la lega?" }).getByRole("button", { name: "Conferma" }).click();
  await expect(page.getByText(/Nessuna lega ancora/)).toBeVisible();
  expect(dialoghiDelBrowser).toEqual([]);
});

test("«Numero gironi» non cancella nulla mentre si scrive né ridigitando lo stesso valore; un cambio vero con risultati chiede conferma", async ({ page }) => {
  await ospiteConLega(page);
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
  await page.locator("input.scorein").nth(0).fill("21");
  await page.locator("input.scorein").nth(1).fill("15");
  await page.getByRole("button", { name: /Salva risultato/i }).first().click();
  await expect(page.getByText("21", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /Modifica/ }).click();
  const gironi = page.getByLabel("Numero gironi");

  // Mentre si scrive, e ridigitando lo stesso numero (2), sorteggio e risultato restano: nessuna finestra
  await gironi.fill("");
  await gironi.fill("2");
  await gironi.press("Tab");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Girone A" })).toBeVisible();
  await expect(page.getByText("21", { exact: true }).first()).toBeVisible();

  // Un numero diverso, con un risultato registrato, chiede conferma; «Annulla» lascia tutto com'era
  await gironi.fill("1");
  await gironi.press("Tab");
  const finestra = page.getByRole("alertdialog", { name: "Cambiare il numero di gironi?" });
  await expect(finestra).toContainText("Verranno eliminati il sorteggio e 1 risultato.");
  await finestra.getByRole("button", { name: "Annulla" }).click();
  await expect(gironi).toHaveValue("2");
  await expect(page.getByRole("heading", { name: "Girone A" })).toBeVisible();
  await expect(page.getByText("21", { exact: true }).first()).toBeVisible();
});

test("un nome lungo e senza spazi resta dentro la finestra di conferma", async ({ page }) => {
  await ospiteConLega(page);
  await page.getByLabel(/Nome tappa/i).fill("N".repeat(120)); // il massimo che il campo ammette
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  const scheda = page.getByRole("alertdialog", { name: "Eliminare la tappa?" });
  await expect(scheda).toContainText("N".repeat(120));
  // Se il nome non va a capo, il testo è più largo del corpo della finestra, che scorrerebbe in orizzontale
  const sbordo = await scheda.locator("p").evaluate((testo) => {
    const corpo = testo.parentElement as HTMLElement;
    return corpo.scrollWidth - corpo.clientWidth;
  });
  expect(sbordo).toBeLessThanOrEqual(0);
  await scheda.getByRole("button", { name: "Annulla" }).click();
});
