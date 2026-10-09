import { test, expect, type Page } from "@playwright/test";
import { bloccaApiNonPreviste, errore, json, rispondiAlRisveglio } from "./helpers";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/* La pagina dei Campetti sulla build di produzione, senza la chiave di Google (la CI non ce l'ha): si esercita la mappa schematica.
 * Il server finto imita GET /api/campetti del contratto (D9): per raggio ordina per distanza, per testo filtra su nome e città. */

/** Due campetti di Roma, dove la pagina si apre, oltre ai sei di Torino della fixture */
function campettoDiRoma(n: number, nome: string, lat: number, lng: number) {
  return { ...CAMPETTI_DEMO[0], id: `r0000000-0000-4000-8000-00000000000${n}`, nome, indirizzo: "", citta: "Roma", lat, lng };
}
const TESTACCIO = campettoDiRoma(1, "Campo Testaccio", 41.8768, 12.4761);
const PAMPHILI = campettoDiRoma(2, "Villa Pamphili — Playground", 41.8838, 12.4440);
const TUTTI = [...CAMPETTI_DEMO, PAMPHILI, TESTACCIO];

/** Il centro di Torino: dove sta l'utente dei test (Playwright lo dà al browser come posizione) */
const TORINO = { latitude: 45.0703, longitude: 7.6869 };

/** Distanza in linea d'aria (km), per imitare l'ordine del server: la formula di Haversine come in src/utils/geo */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** La risposta del server vero ai parametri della richiesta: per raggio i campetti entro il raggio ordinati per distanza; per testo
 *  quelli con il testo nel nome o nella città, per città e nome, o per distanza se ci sono anche lat e lng */
function rispostaDelServer(url: URL) {
  const p = url.searchParams;
  const q = p.get("q");
  const centro = { lat: Number(p.get("lat")), lng: Number(p.get("lng")) };
  const perDistanza = (a: typeof TESTACCIO, b: typeof TESTACCIO) => km(centro, a) - km(centro, b);
  if (q !== null) {
    const testo = q.toLowerCase();
    const trovati = TUTTI.filter((c) => c.nome.toLowerCase().includes(testo) || c.citta.toLowerCase().includes(testo));
    if (p.has("lat") && p.has("lng")) return trovati.sort(perDistanza);
    return trovati.sort((a, b) => a.citta.localeCompare(b.citta) || a.nome.localeCompare(b.nome));
  }
  const raggio = Number(p.get("raggioKm"));
  return TUTTI.filter((c) => km(centro, c) <= raggio).sort(perDistanza);
}

/** Il server finto dei campetti: risponde come quello vero e registra le query string ricevute. Con `giu` risponde 500.
 *  @returns le query string delle richieste e le chiamate non previste (a fine test devono essere nessuna) */
async function serverFinto(page: Page, stato = { giu: false }) {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  const richieste: string[] = [];
  await page.route("**/api/campetti?**", (route) => {
    const url = new URL(route.request().url());
    richieste.push(url.search);
    if (stato.giu) return route.fulfill(errore(500, "Errore interno"));
    return route.fulfill(json(rispostaDelServer(url)));
  });
  return { richieste, nonPreviste };
}

/** Entra come Ospite e apre i Campetti dal menu */
async function apriCampetti(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Campetti" }).click();
  await expect(page.getByRole("heading", { name: "Campetti" })).toBeVisible();
}

/** I nomi delle card, nell'ordine in cui compaiono */
const nomiDelleCard = (page: Page) => page.getByRole("article").evaluateAll((card) => card.map((c) => c.getAttribute("aria-label")));

test("all'apertura i campetti intorno a Roma dall'API, la mappa schematica con i pin, «Aggiungi» in arrivo; nessuna posizione chiesta", async ({ page }) => {
  const { richieste, nonPreviste } = await serverFinto(page);
  await apriCampetti(page);
  await expect(page.getByRole("article", { name: "Campo Testaccio" })).toBeVisible();
  expect(richieste).toEqual(["?lat=41.9028&lng=12.4964&raggioKm=20"]);
  await expect(page.getByText("2 campetti · intorno a Roma")).toBeVisible();
  expect(await nomiDelleCard(page)).toEqual(["Campo Testaccio", "Villa Pamphili — Playground"]);
  // Senza chiave: la griglia schematica, con i pin come pulsanti; nessuna immagine di Google
  await expect(page.getByText("Mappa schematica")).toBeVisible();
  await expect(page.getByRole("button", { name: "Campo Testaccio", exact: true })).toBeVisible();
  await expect(page.locator("img[src*='maps.googleapis.com']")).toHaveCount(0);
  await expect(page.getByText("Dati di esempio")).toHaveCount(0);
  const aggiungi = page.getByRole("button", { name: /Aggiungi un campetto/ });
  await expect(aggiungi).toBeDisabled();
  await expect(aggiungi).toHaveAttribute("title", "In arrivo");
  // Un clic sul pin seleziona la card
  await page.getByRole("button", { name: "Villa Pamphili — Playground", exact: true }).click();
  await expect(page.getByRole("article", { name: "Villa Pamphili — Playground" }).getByRole("button")).toHaveAttribute("aria-pressed", "true");
  expect(nonPreviste).toEqual([]);
});

test("posizione concessa (a Torino): i campetti intorno all'utente, con le distanze, in ordine di distanza, e il pin dell'utente", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(TORINO);
  const { richieste, nonPreviste } = await serverFinto(page);
  await apriCampetti(page);
  await expect(page.getByRole("article", { name: "Campo Testaccio" })).toBeVisible();

  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Posizione trovata" })).toBeVisible();
  await expect(page.getByText("6 campetti · intorno a te")).toBeVisible();
  expect(richieste[1]).toBe(`?lat=${TORINO.latitude}&lng=${TORINO.longitude}&raggioKm=20`);
  // L'ordine del server (per distanza) è anche quello della pagina: Giardini Reali è il più vicino al centro
  const utente = { lat: TORINO.latitude, lng: TORINO.longitude };
  const attesi = [...CAMPETTI_DEMO].sort((a, b) => km(utente, a) - km(utente, b)).map((c) => c.nome);
  expect(await nomiDelleCard(page)).toEqual(attesi);
  expect(attesi[0]).toBe("Giardini Reali — Playground");
  // Ogni card ha la distanza, scritta all'italiana
  const card = page.getByRole("article", { name: "Giardini Reali — Playground" });
  await expect(card.getByText(/^\d+ m$|^\d+,\d km$/)).toBeVisible();
  await expect(page.getByText("La tua posizione")).toHaveCount(1);
  expect(nonPreviste).toEqual([]);
});

test("posizione negata: il messaggio lo dice, i campetti restano quelli di Roma in ordine di nome, senza distanze", async ({ page }) => {
  // Nessun permesso concesso: il browser di Playwright nega la richiesta
  const { richieste, nonPreviste } = await serverFinto(page);
  await apriCampetti(page);
  await expect(page.getByRole("article", { name: "Campo Testaccio" })).toBeVisible();
  await page.getByRole("button", { name: "Usa la mia posizione" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Posizione negata" })).toBeVisible();
  expect(await nomiDelleCard(page)).toEqual(["Campo Testaccio", "Villa Pamphili — Playground"]);
  await expect(page.getByText(/^\d+ m$|^\d+,\d km$/)).toHaveCount(0);
  expect(richieste).toHaveLength(1); // nessuna posizione è andata al server
  expect(nonPreviste).toEqual([]);
});

test("«Indicazioni» e «Apri in Google Maps» portano a Google Maps con le coordinate del campetto, in una nuova scheda", async ({ page }) => {
  await serverFinto(page);
  await apriCampetti(page);
  const card = page.getByRole("article", { name: "Campo Testaccio" });
  const indicazioni = card.getByRole("link", { name: "Indicazioni" });
  await expect(indicazioni).toHaveAttribute("href", `https://www.google.com/maps/dir/?api=1&destination=${TESTACCIO.lat},${TESTACCIO.lng}`);
  await expect(indicazioni).toHaveAttribute("target", "_blank");
  await expect(indicazioni).toHaveAttribute("rel", "noopener noreferrer");
  await expect(card.getByRole("link", { name: "Apri in Google Maps" }))
    .toHaveAttribute("href", `https://www.google.com/maps/search/?api=1&query=${TESTACCIO.lat},${TESTACCIO.lng}`);
});

test("la ricerca per testo interroga il server con q su tutta l'Italia; la casella vuota torna a Roma", async ({ page }) => {
  const { richieste, nonPreviste } = await serverFinto(page);
  await apriCampetti(page);
  await expect(page.getByRole("article", { name: "Campo Testaccio" })).toBeVisible();
  await page.getByLabel("Cerca città o campo").fill("Dora");
  await expect(page.getByRole("article", { name: "Parco Dora — Le Arcate" })).toBeVisible();
  await expect(page.getByText("1 campetto · in tutta Italia")).toBeVisible();
  expect(richieste).toEqual(["?lat=41.9028&lng=12.4964&raggioKm=20", "?q=Dora"]);
  await page.getByLabel("Cerca città o campo").fill("");
  await expect(page.getByText("2 campetti · intorno a Roma")).toBeVisible();
  expect(richieste[2]).toBe("?lat=41.9028&lng=12.4964&raggioKm=20");
  expect(nonPreviste).toEqual([]);
});

test("server in errore: il motivo con «Riprova», non «Nessun campetto»; «Riprova» richiama il server", async ({ page }) => {
  const stato = { giu: true };
  const { nonPreviste } = await serverFinto(page, stato);
  await apriCampetti(page);
  const avviso = page.getByRole("alert");
  await expect(avviso).toContainText("Non è stato possibile caricare i campetti");
  await expect(avviso).toContainText("Errore interno");
  await expect(page.getByText(/Nessun campetto/)).toHaveCount(0);
  stato.giu = false;
  await avviso.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByRole("article", { name: "Campo Testaccio" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(nonPreviste).toEqual([]);
});
