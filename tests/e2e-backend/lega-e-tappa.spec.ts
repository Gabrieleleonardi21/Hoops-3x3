import { test, expect } from "@playwright/test";
import { registraUtenteNuovo, rispostaA } from "./helpers";

/* Lega e tappa sul server vero: è il percorso di percorso-registrato.spec.ts (server finto) con le risposte del backend. Qui si
 * fissa il contratto che il server finto deve imitare: la POST della tappa risponde 201 con versione 0, la PUT 200 con la versione
 * aumentata di uno, e dopo una ricarica i dati sono quelli salvati. */

test("lega e tappa nascono sul server (201, versione 0), una modifica è una PUT (versione 1) e tutto resta dopo una ricarica", async ({ page }) => {
  await registraUtenteNuovo(page);

  // La lega nuova: 201 dal server, poi la pagina della lega
  const postLega = rispostaA(page, "POST", /^\/api\/leghe$/);
  await page.getByLabel(/Nome della nuova lega/i).fill("Circuito Roma");
  await page.getByRole("button", { name: /Crea lega/i }).click();
  expect((await postLega).status()).toBe(201);
  await expect(page).toHaveURL(/\/lega$/);

  // La tappa nuova parte con una POST nella lega dopo l'attesa del salvataggio (400 ms): la prima versione la decide il server, ed è 0
  const postTappa = rispostaA(page, "POST", /^\/api\/leghe\/[^/]+\/tappe$/);
  await page.getByLabel(/Nome tappa/i).fill("Roma Open");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await expect(page.getByRole("heading", { name: "Roma Open" })).toBeVisible();
  const creata = await postTappa;
  expect(creata.status()).toBe(201);
  const corpoCreata = await creata.json();
  expect(corpoCreata).toMatchObject({ nome: "Roma Open", luogo: "", versione: 0 });
  expect(corpoCreata.squadre).toHaveLength(8);

  // Una modifica è una PUT sulla stessa tappa con la versione letta (0): il server risponde con quella nuova (1)
  const putTappa = rispostaA(page, "PUT", /^\/api\/tappe\/[^/]+$/);
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Luogo").fill("Testaccio");
  const salvata = await putTappa;
  expect(salvata.status()).toBe(200);
  expect(salvata.request().postDataJSON()).toMatchObject({ id: corpoCreata.id, luogo: "Testaccio", versione: 0 });
  expect(await salvata.json()).toMatchObject({ id: corpoCreata.id, luogo: "Testaccio", versione: 1 });
  await expect(page.getByText(/modifiche non salvate/)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Dopo una ricarica l'app rilegge tutto dal server: la tappa c'è con il luogo salvato, e la versione in uso è la 1 (una PUT
  // successiva la manda, e il server la accetta)
  await page.reload();
  await expect(page.getByRole("heading", { name: "Roma Open" })).toBeVisible();
  await page.getByRole("button", { name: "Modifica" }).click();
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");
  const putDopo = rispostaA(page, "PUT", /^\/api\/tappe\/[^/]+$/);
  await page.getByLabel("Luogo").fill("Ostiense");
  const salvataDopo = await putDopo;
  expect(salvataDopo.request().postDataJSON()).toMatchObject({ luogo: "Ostiense", versione: 1 });
  expect(await salvataDopo.json()).toMatchObject({ luogo: "Ostiense", versione: 2 });
});
