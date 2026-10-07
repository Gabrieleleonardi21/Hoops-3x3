import { test, expect } from "@playwright/test";

/** Risposta di errore del server nel formato {message, timestamp} */
const errore503 = {
  status: 503, contentType: "application/json",
  body: JSON.stringify({ message: "Servizio non disponibile", timestamp: "2026-10-05T10:00:00" }),
};
const json = (corpo: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });

test("anagrafe con il server in errore: messaggio con «Riprova», non «Nessun giocatore registrato»", async ({ page }) => {
  // Nessuna chiamata al backend vero: le risposte le decide il test
  let giu = true;
  await page.route("**/api/anagrafe/**", (route) => {
    if (giu) return route.fulfill(errore503);
    if (route.request().url().endsWith("/giocatori")) {
      // Chi apre l'anagrafe da ospite riceve la forma pubblica: dati personali e autore vuoti, autoreId null
      return route.fulfill(json([{
        id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "",
        peso: "", ruolo: "Guardia", numero: "", squadra: "", esperienza: "", note: "", autore: "", autoreId: null, ts: 1,
      }]));
    }
    return route.fulfill(json([]));
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Anagrafe" }).click();

  const avviso = page.getByRole("alert");
  await expect(avviso).toContainText("Non è stato possibile caricare l'anagrafe");
  await expect(avviso).toContainText("Servizio non disponibile");
  await expect(page.getByText(/Nessun giocatore registrato/)).toHaveCount(0);

  giu = false;
  await avviso.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByRole("button", { name: "Mario Rossi" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("archivio con il server in errore: messaggio con «Riprova», non «L'archivio è vuoto»", async ({ page }) => {
  let giu = true;
  await page.route("**/api/archivio", (route) => {
    if (giu) return route.fulfill(errore503);
    return route.fulfill(json([]));
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Archivio circuito" }).click();

  const avviso = page.getByRole("alert");
  await expect(avviso).toContainText("Non è stato possibile caricare l'archivio del circuito");
  await expect(page.getByText(/L'archivio è vuoto/)).toHaveCount(0);

  giu = false;
  await avviso.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText(/L'archivio è vuoto/)).toBeVisible();
});

test("archivio con l'elenco nella forma di prima (backend non ancora aggiornato): errore con «Riprova», non righe vuote né pagina bianca", async ({ page }) => {
  // Il frontend nuovo va online prima del backend: per qualche minuto ogni voce ha la tappa intera e nessuno degli otto campi sintetici
  const vecchia = [{ tappa: { id: "t1", nome: "Finals – Roma", squadre: [] }, lega: "Estate", autore: "Anna", autoreId: "u1", ts: 1 }];
  const nuova = [{ tappaId: "t1", nome: "Finals – Roma", luogo: "Roma", data: "2025-09-13", nSquadre: 8, lega: "Estate", autore: "Anna", ts: 1 }];
  let elenco: unknown[] = vecchia;
  await page.route("**/api/archivio", (route) => route.fulfill(json(elenco)));
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Archivio circuito" }).click();

  const avviso = page.getByRole("alert");
  await expect(avviso).toContainText("Non è stato possibile caricare l'archivio del circuito");
  await expect(avviso).toContainText("Risposta del server non valida");
  await expect(page.getByText("Finals – Roma")).toHaveCount(0);
  await expect(page.getByText(/L'archivio è vuoto/)).toHaveCount(0);

  // Il backend è stato aggiornato: «Riprova» mostra la riga, scritta dai campi della voce sintetica
  elenco = nuova;
  await avviso.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText("Finals – Roma")).toBeVisible();
  await expect(page.getByText("8 squadre · di Anna")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("pagina pubblica di una tappa con il server in errore: il motivo con «Riprova», non «Tappa non trovata»; con 404 sì", async ({ page }) => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  let risposta: "errore" | "mancante" = "errore";
  await page.route(`**/api/archivio/${id}`, (route) => {
    if (risposta === "errore") return route.fulfill(errore503);
    return route.fulfill({
      status: 404, contentType: "application/json",
      body: JSON.stringify({ message: "Tappa non trovata nell'archivio", timestamp: "2026-10-05T10:00:00" }),
    });
  });
  await page.goto(`/tappa/${id}`);
  const avviso = page.getByRole("alert");
  await expect(avviso).toContainText("Non è stato possibile caricare la tappa");
  await expect(avviso).toContainText("Servizio non disponibile");
  await expect(page.getByText(/Tappa non trovata/)).toHaveCount(0);

  // Il server risponde 404: adesso sì, la tappa non c'è
  risposta = "mancante";
  await avviso.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText(/Tappa non trovata nell'archivio/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
