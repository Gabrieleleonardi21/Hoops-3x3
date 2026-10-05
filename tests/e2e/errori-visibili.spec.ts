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
      return route.fulfill(json([{
        id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "",
        peso: "", ruolo: "Guardia", numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
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
