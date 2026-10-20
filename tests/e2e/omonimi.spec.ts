import { test, expect, type Route } from "@playwright/test";
import { giocatoreDiAnna, ID, json, serverConTappa, squadraDiAnna, tappaSulServer, utenteRegistrato } from "./helpers";

/* Il primo percorso end-to-end sugli omonimi (fase 11b): due squadre con lo stesso nome nell'anagrafe, e due giocatori con lo stesso
 * nome registrati in squadre diverse. Il server è finto (page.route), come negli altri percorsi: le chiamate senza risposta finta
 * si controllano a fine test, perché niente arrivi al proxy di Vite. */

/** Il salvataggio della tappa: il server risponde con la stessa tappa e la versione successiva, come fa quello vero */
const salva = (route: Route) => {
  const corpo = route.request().postDataJSON();
  return route.fulfill(json({ ...corpo, versione: corpo.versione + 1 }));
};

test("due «Roma» nell'anagrafe: scrivere il nome di una squadra di tappa chiede quale collegare, e «Collega» prende la scelta", async ({ page }) => {
  const torino = { ...squadraDiAnna("s1", "Roma"), citta: "Torino", logo: "/logos/the-goat-torino.svg" };
  const milano = { ...squadraDiAnna("s2", "Roma"), citta: "Milano", logo: "/logos/ub-kings.svg" };
  // La tappa del server ha una sola squadra, ancora con il nome segnaposto
  const { nonPreviste } = await serverConTappa(page, {
    salva,
    tappa: () => ({ ...tappaSulServer("Roma", 3), squadre: [{ id: "sq1", nome: "Squadra 1", giocatori: [], rank: "" }] }),
  });
  // Dopo utenteRegistrato (dentro serverConTappa) questa rotta vince: l'anagrafe ha le due «Roma»
  await page.route("**/api/anagrafe/squadre", (route) => route.fulfill(json([torino, milano])));
  await page.goto("/lega/tappa/t1");

  // Il nome scritto e il campo lasciato: le «Roma» sono due, quindi la finestra chiede quale collegare, e niente è ancora collegato
  await page.getByLabel("Nome squadra").fill("Roma");
  await page.getByLabel("Nome squadra").blur();
  const finestra = page.getByRole("alertdialog", { name: /Più squadre si chiamano «Roma»/ });
  await expect(finestra).toBeVisible();
  await expect(page.getByRole("button", { name: "Scollega" })).toHaveCount(0);

  // Si sceglie Milano e si collega: la card mostra «Scollega» e il logo di Milano
  await finestra.getByRole("radio", { name: /Milano/ }).check();
  await finestra.getByRole("button", { name: "Collega", exact: true }).click();
  await expect(finestra).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scollega" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Logo Roma" })).toHaveAttribute("src", "/logos/ub-kings.svg");
  expect(nonPreviste).toEqual([]);
});

test("due Mario Rossi registrati in squadre collegate diverse: la stagione ha due righe, e ogni scheda conta solo le sue gare", async ({ page }) => {
  const giocatori = [giocatoreDiAnna("g1", "Mario", "Rossi"), giocatoreDiAnna("g2", "Mario", "Rossi")];
  const squadre = [
    { ...squadraDiAnna("s1", "Ballers"), roster: ["g1"] },
    { ...squadraDiAnna("s2", "Lupi"), roster: ["g2"] },
  ];
  await utenteRegistrato(page, { giocatori, squadre });
  // Una tappa pubblicata: Mario di Ballers gioca una sola gara (12 punti); Mario di Lupi ne gioca due (7 e 4 punti). Alfa è una
  // squadra senza anagrafe, con il suo giocatore: serve solo a far giocare Lupi due volte
  const tappa = {
    id: ID, nome: "Roma Open", luogo: "Roma", data: "2026-06-14", nGironi: 1, regole: { target: 21, durata: 10, ot: 2, shot: 12 },
    squadre: [
      { id: "sa", nome: "Ballers", regId: "s1", rank: "", giocatori: [{ id: "p1", nome: "Mario Rossi", regId: "g1" }] },
      { id: "sb", nome: "Lupi", regId: "s2", rank: "", giocatori: [{ id: "p2", nome: "Mario Rossi", regId: "g2" }] },
      { id: "sc", nome: "Alfa", rank: "", giocatori: [{ id: "p3", nome: "Carlo Bianchi" }] },
    ],
    gironi: [["sa", "sb", "sc"]],
    partite: [
      { id: "m1", g: 0, a: "sa", b: "sb", sa: 21, sb: 15, done: true, pa: { p1: { pt: 12 } }, pb: { p2: { pt: 7 } } },
      { id: "m2", g: 0, a: "sb", b: "sc", sa: 18, sb: 21, done: true, pa: { p2: { pt: 4 } }, pb: { p3: { pt: 9 } } },
    ],
    video: [], conclusa: true, bracket: null,
  };
  await page.route("**/api/archivio/tappe", (route) => route.fulfill(json([{ tappa, lega: "Circuito", autore: "Anna", autoreId: "u1", ts: 1 }])));

  // La tabella di stagione: due righe «Mario Rossi», una per squadra collegata
  await page.goto("/anagrafe");
  await page.getByRole("tab", { name: "Statistiche stagione" }).click();
  await expect(page.getByRole("row", { name: /Mario Rossi/ })).toHaveCount(2);

  // La scheda di ciascuno (la pagina del giocatore): nello storico della tappa ha solo le sue gare e i suoi punti
  await page.goto("/giocatore/g1");
  const storico1 = page.getByRole("table", { name: /Storico tappe di Mario Rossi/ });
  await expect(storico1.getByRole("cell", { name: "1", exact: true })).toBeVisible();
  await expect(storico1.getByRole("cell", { name: "12", exact: true })).toBeVisible();

  await page.goto("/giocatore/g2");
  const storico2 = page.getByRole("table", { name: /Storico tappe di Mario Rossi/ });
  await expect(storico2.getByRole("cell", { name: "2", exact: true })).toBeVisible();
  await expect(storico2.getByRole("cell", { name: "11", exact: true })).toBeVisible();
});

test("due Mario Rossi registrati nella stessa squadra collegata: due righe in stagione, nessun ⚠, ogni scheda con le sue gare", async ({ page }) => {
  const giocatori = [giocatoreDiAnna("g1", "Mario", "Rossi"), giocatoreDiAnna("g2", "Mario", "Rossi")];
  const squadre = [{ ...squadraDiAnna("s1", "Ballers"), roster: ["g1", "g2"] }];
  await utenteRegistrato(page, { giocatori, squadre });
  // Una tappa conclusa dall'archivio: Ballers è la squadra collegata con i due Mario. Mario (g1) fa 12 punti nella sua gara, Mario
  // (g2) ne fa 9 nella stessa. Alfa è una squadra senza anagrafe, con il suo giocatore
  const tappa = {
    id: ID, nome: "Roma Open", luogo: "Roma", data: "2026-06-14", nGironi: 1, regole: { target: 21, durata: 10, ot: 2, shot: 12 },
    squadre: [
      { id: "sa", nome: "Ballers", regId: "s1", rank: "", giocatori: [{ id: "p1", nome: "Mario Rossi", regId: "g1" }, { id: "p2", nome: "Mario Rossi", regId: "g2" }] },
      { id: "sc", nome: "Alfa", rank: "", giocatori: [{ id: "p3", nome: "Carlo Bianchi" }] },
    ],
    gironi: [["sa", "sc"]],
    partite: [
      { id: "m1", g: 0, a: "sa", b: "sc", sa: 21, sb: 15, done: true, pa: { p1: { pt: 12 }, p2: { pt: 9 } }, pb: { p3: { pt: 15 } } },
    ],
    video: [], conclusa: true, bracket: null,
  };
  await page.route("**/api/archivio/tappe", (route) => route.fulfill(json([{ tappa, lega: "Circuito", autore: "Anna", autoreId: "u1", ts: 1 }])));

  // La tabella di stagione: due righe «Mario Rossi» e nessun segno di avviso
  await page.goto("/anagrafe");
  await page.getByRole("tab", { name: "Statistiche stagione" }).click();
  await expect(page.getByRole("row", { name: /Mario Rossi/ })).toHaveCount(2);
  await expect(page.getByText("⚠")).toHaveCount(0);

  // La scheda di ciascuno: nello storico della tappa ha solo la sua gara e i suoi punti
  await page.goto("/giocatore/g1");
  const storico1 = page.getByRole("table", { name: /Storico tappe di Mario Rossi/ });
  await expect(storico1.getByRole("cell", { name: "12", exact: true })).toBeVisible();

  await page.goto("/giocatore/g2");
  const storico2 = page.getByRole("table", { name: /Storico tappe di Mario Rossi/ });
  await expect(storico2.getByRole("cell", { name: "9", exact: true })).toBeVisible();
});
