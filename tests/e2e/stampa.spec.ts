import { test, expect } from "@playwright/test";
import { json, rispondiAlRisveglio } from "./helpers";

/** Una tappa pubblicata nell'archivio: due squadre in un girone, una partita giocata */
const id = "123e4567-e89b-42d3-a456-426614174001";
const pubblicata = {
  lega: "Lega", autore: "Anna", autoreId: "u1", ts: 1,
  tappa: {
    id, nome: "Roma Open", luogo: "Roma", data: "2026-06-01", nGironi: 1, conclusa: true,
    regole: { target: 21, durata: 10, ot: 2, shot: 12 },
    squadre: [
      { id: "s1", nome: "Alfa", giocatori: [], rank: "" },
      { id: "s2", nome: "Beta", giocatori: [], rank: "" },
    ],
    gironi: [["s1", "s2"]],
    partite: [{ id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true }],
    video: [],
  },
};

// «Stampa / PDF» della vista di una tappa: su carta restano le schede delle squadre e le intestazioni della classifica (sono
// <button>), spariscono solo i comandi .no-print, e il testo è scuro su bianco
test("stampa di una tappa: squadre e intestazioni della classifica restano, testo scuro su carta bianca", async ({ page }) => {
  await rispondiAlRisveglio(page);
  await page.route(`**/api/archivio/${id}`, (route) => route.fulfill(json(pubblicata)));
  await page.goto(`/tappa/${id}`);
  await expect(page.getByRole("heading", { name: "Roma Open" })).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: /Stampa \/ PDF/ })).toBeHidden();
  await expect(page.getByRole("button", { name: /Alfa/ }).first()).toBeVisible();
  await expect(page.getByRole("columnheader").getByRole("button", { name: "V", exact: true }).first()).toBeVisible();

  // Il titolo usa text-chalk: sulla carta deve essere scuro, non il chiaro del tema
  const colore = await page.getByRole("heading", { name: "Roma Open" }).evaluate((el) => getComputedStyle(el).color);
  expect(colore).toBe("rgb(0, 0, 0)");
  const sfondo = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(sfondo).toBe("rgb(255, 255, 255)");
});
