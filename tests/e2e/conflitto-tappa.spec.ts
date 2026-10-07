import { test, expect } from "@playwright/test";
import { json, utenteRegistrato } from "./helpers";

/* Tappe protette dalle sovrascritture tra dispositivi (T2.7): la PUT porta la versione letta e, se nel frattempo un altro
 * dispositivo ha salvato la tappa, il server risponde 409. Server finto: le risposte le decide il test. */

const regole = { target: 21, durata: 10, ot: 2, shot: 12 };
/** La tappa come la manda il server, con la sua versione */
const tappaSulServer = (luogo: string, versione: number) => ({
  id: "t1", nome: "Roma Open", luogo, data: "", nGironi: 1, regole, squadre: [], gironi: null, partite: [], video: [],
  conclusa: false, bracket: null, versione,
});

test("una tappa salvata intanto da un altro dispositivo non si sovrascrive: l'app mostra quella del server e lo dice", async ({ page }) => {
  await utenteRegistrato(page);
  // Anna ha aperto la lega «Circuito» l'ultima volta: al caricamento si legge dal server, con la tappa alla versione 3
  await page.addInitScript(() => localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1"));
  await page.route("**/api/leghe", (route) => route.fulfill(json([{ id: "l1", nome: "Circuito", ts: 1, nTappe: 1 }])));
  let sulServer = tappaSulServer("Roma", 3);
  await page.route("**/api/leghe/l1", (route) => route.fulfill(json({ id: "l1", nome: "Circuito", tappe: [sulServer] })));
  const inviate: unknown[] = [];
  await page.route("**/api/tappe/t1", async (route) => {
    inviate.push(route.request().postDataJSON());
    // Un altro dispositivo l'ha salvata prima: sul server c'è la sua versione, e questa PUT non salva niente
    sulServer = tappaSulServer("Ostia", 4);
    await route.fulfill({
      status: 409, contentType: "application/json",
      body: JSON.stringify({ message: "La tappa è stata modificata da un altro dispositivo: ricaricala", timestamp: 1 }),
    });
  });

  await page.goto("/lega/tappa/t1");
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Luogo").fill("Testaccio");

  await expect(page.getByText("La tappa «Roma Open» è stata modificata da un altro dispositivo: ora vedi la versione salvata sul server"))
    .toBeVisible();
  await expect(page.getByLabel("Luogo")).toHaveValue("Ostia");
  // Una sola PUT, con la versione letta: il corpo superato non riparte
  expect(inviate).toEqual([expect.objectContaining({ luogo: "Testaccio", versione: 3 })]);
});
