import { test, expect } from "@playwright/test";
import { apriModifica, errore, serverConTappa, tappaSulServer } from "./helpers";

/* Tappe protette dalle sovrascritture tra dispositivi (T2.7): la PUT porta la versione letta e, se nel frattempo un altro
 * dispositivo ha salvato la tappa, il server risponde 409. Server finto: le risposte le decide il test. */

test("una tappa salvata intanto da un altro dispositivo non si sovrascrive: l'app mostra quella del server e lo dice", async ({ page }) => {
  // Anna ha aperto la lega «Circuito» l'ultima volta: al caricamento si legge dal server, con la tappa alla versione 3
  let sulServer = tappaSulServer("Roma", 3);
  const { inviate, nonPreviste } = await serverConTappa(page, {
    tappa: () => sulServer,
    salva: (route) => {
      // Un altro dispositivo l'ha salvata prima: sul server c'è la sua versione, e questa PUT non salva niente
      sulServer = tappaSulServer("Ostia", 4);
      return route.fulfill(errore(409, "La tappa è stata modificata da un altro dispositivo: ricaricala"));
    },
  });

  await apriModifica(page);
  await page.getByLabel("Luogo").fill("Testaccio");

  await expect(page.getByText("La tappa «Roma Open» è stata modificata da un altro dispositivo: ora vedi la versione salvata sul server"))
    .toBeVisible();
  await expect(page.getByLabel("Luogo")).toHaveValue("Ostia");
  // Una sola PUT, con la versione letta: il corpo superato non riparte
  expect(inviate).toEqual([expect.objectContaining({ luogo: "Testaccio", versione: 3 })]);
  expect(nonPreviste).toEqual([]);
});
