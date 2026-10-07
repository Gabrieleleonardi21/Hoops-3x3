import { test, expect, type Page, type Route } from "@playwright/test";
import { bloccaApiNonPreviste, json, rispondiAlRisveglio, tokenFinto, utenteRegistrato } from "./helpers";

/* Percorso dell'utente registrato, con il server finto (page.route). Lo scenario con il backend vero (prototipi/verifiche/refresh.spec.ts)
 * resta una prova manuale: in CI servirebbero backend e database. Ogni test chiude controllando che nessuna chiamata a /api sia rimasta
 * senza risposta finta, cioè che niente sia arrivato al proxy di Vite. Il 409 della tappa lo prova conflitto-tappa, i 503 delle pagine
 * errori-visibili. */

const utente = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" };
const regole = { target: 21, durata: 10, ot: 2, shot: 12 };
/** La tappa «Roma Open» come la manda il server, alla versione 3 */
const tappaSulServer = {
  id: "t1", nome: "Roma Open", luogo: "Roma", data: "", nGironi: 1, regole, squadre: [], gironi: null, partite: [], video: [],
  conclusa: false, bracket: null, versione: 3,
};

/** Risposta di errore del server, nel formato {message, timestamp} */
const errore = (status: number, message: string) => ({
  status, contentType: "application/json", body: JSON.stringify({ message, timestamp: 1 }),
});

/** Il server di Anna, che ha già la lega «Circuito» con la tappa «Roma Open»: `salva` risponde alle PUT della tappa, e il test decide come.
 *  Va chiamata prima di aprire la pagina.
 *  @returns i corpi delle PUT ricevute (anche quelle andate male) e le chiamate non previste */
async function serverConTappa(page: Page, salva: (route: Route) => Promise<void>) {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await utenteRegistrato(page); // sessione di Anna nel browser, me e anagrafe (più un elenco di leghe vuoto, sostituito qui sotto)
  // L'ultima lega aperta è «Circuito»: al caricamento l'app la legge dal server
  await page.addInitScript(() => localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1"));
  await page.route("**/api/leghe", (route) => route.fulfill(json([{ id: "l1", nome: "Circuito", ts: 1, nTappe: 1 }])));
  await page.route("**/api/leghe/l1", (route) => route.fulfill(json({ id: "l1", nome: "Circuito", tappe: [tappaSulServer] })));
  const inviate: unknown[] = [];
  await page.route("**/api/tappe/t1", (route) => {
    inviate.push(route.request().postDataJSON());
    return salva(route);
  });
  return { inviate, nonPreviste };
}

/** Apre la pagina della tappa e il pannello «Modifica», dove si scrive il luogo: ogni modifica parte da qui verso il server */
async function apriModifica(page: Page) {
  await page.goto("/lega/tappa/t1");
  await page.getByRole("button", { name: "Modifica" }).click();
}

test("accesso e salvataggio: dal modulo di accesso a lega e tappa, e ogni modifica arriva al server con il suo corpo, senza avvisi", async ({ page }) => {
  // Accesso, lega, tappa e modifica in un test solo: i 15 secondi della configurazione bastano a un passo, non a una macchina carica
  test.setTimeout(30_000);
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  // Il server finto ricorda ciò che riceve
  const accessi: unknown[] = [];
  const leghe: unknown[] = [];
  const tappeCreate: unknown[] = [];
  const tappeSalvate: unknown[] = [];
  await page.route("**/api/auth/login", (route) => {
    accessi.push(route.request().postDataJSON());
    return route.fulfill(json({ token: tokenFinto, user: utente }));
  });
  await page.route("**/api/leghe", (route) => {
    if (route.request().method() !== "POST") return route.fulfill(json([]));
    const corpo = route.request().postDataJSON();
    leghe.push(corpo);
    return route.fulfill(json({ id: "l1", nome: corpo.nome, ts: 1, nTappe: 0 }));
  });
  await page.route("**/api/leghe/l1/tappe", (route) => {
    const corpo = route.request().postDataJSON();
    tappeCreate.push(corpo);
    return route.fulfill(json({ ...corpo, versione: 1 })); // la prima versione la decide il server
  });
  await page.route("**/api/tappe/*", (route) => {
    const corpo = route.request().postDataJSON();
    tappeSalvate.push(corpo);
    return route.fulfill(json({ ...corpo, versione: 2 }));
  });
  await page.route("**/api/anagrafe/**", (route) => route.fulfill(json([])));

  // Accesso dal modulo: le credenziali arrivano al server, l'utente entra e il token resta nel browser
  await page.goto("/");
  await page.getByRole("button", { name: "Accedi", exact: true }).first().click(); // la scheda «Accedi» del modulo
  await page.getByLabel("Mail").fill("anna@example.it");
  await page.getByLabel("Password").fill("password-lunga");
  await page.getByRole("button", { name: "Accedi", exact: true }).last().click(); // il pulsante di invio
  await expect(page).toHaveURL(/\/leghe$/);
  await expect(page.getByRole("button", { name: "Esci", exact: true })).toBeVisible();
  expect(accessi).toEqual([{ email: "anna@example.it", password: "password-lunga" }]);
  expect(await page.evaluate(() => localStorage.getItem("hoop3x3_token"))).toBe(tokenFinto);

  // La lega nuova nasce sul server con il suo nome
  await page.getByLabel(/Nome della nuova lega/i).fill("Circuito Roma");
  await page.getByRole("button", { name: /Crea lega/i }).click();
  await expect(page).toHaveURL(/\/lega$/);
  expect(leghe).toEqual([{ nome: "Circuito Roma" }]);

  // La tappa nuova parte con una POST nella lega, dopo l'attesa del salvataggio (400 ms senza altre modifiche)
  await page.getByLabel(/Nome tappa/i).fill("Roma Open");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await expect(page.getByRole("heading", { name: "Roma Open" })).toBeVisible();
  await expect.poll(() => tappeCreate.length).toBe(1);
  expect(tappeCreate[0]).toMatchObject({ nome: "Roma Open", luogo: "", nGironi: 2, gironi: null, partite: [], video: [] });
  expect((tappeCreate[0] as { squadre: unknown[] }).squadre).toHaveLength(8);

  // Una modifica successiva è una PUT sulla stessa tappa, con la versione che il server ha dato alla creazione
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Luogo").fill("Testaccio");
  await expect.poll(() => tappeSalvate.length).toBe(1);
  expect(tappeSalvate[0]).toMatchObject({ id: (tappeCreate[0] as { id: string }).id, nome: "Roma Open", luogo: "Testaccio", versione: 1 });

  // Tutto è andato a buon fine: nessun avviso, e il luogo è ancora sullo schermo
  await expect(page.getByText(/modifiche non salvate/)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");
  expect(nonPreviste).toEqual([]);
});

test("rete assente al salvataggio: l'avviso dice quante tappe aspettano e perché, «Riprova ora» le salva e l'avviso sparisce", async ({ page }) => {
  let reteGiu = true;
  const { inviate, nonPreviste } = await serverConTappa(page, (route) => {
    if (reteGiu) return route.abort("failed");
    return route.fulfill(json({ ...tappaSulServer, luogo: "Testaccio", versione: 4 }));
  });
  await apriModifica(page);
  await page.getByLabel("Luogo").fill("Testaccio");

  // Il server non risponde: l'avviso dice che la tappa non è salvata e il motivo, e ciò che si è scritto resta sullo schermo
  const avviso = page.getByRole("status");
  await expect(avviso).toContainText("1 tappa ha modifiche non salvate");
  await expect(avviso).toContainText("Server non raggiungibile: controlla la connessione o avvia il backend.");
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");

  // La rete torna: un nuovo tentativo salva la tappa e l'avviso scompare
  reteGiu = false;
  await avviso.getByRole("button", { name: "Riprova ora" }).click();
  await expect(avviso).toHaveCount(0);

  // Ogni tentativo, anche quelli andati male, ha mandato la stessa tappa con la versione letta: niente si è perso né cambiato
  expect(inviate.length).toBeGreaterThanOrEqual(2);
  expect(inviate[0]).toMatchObject({ id: "t1", luogo: "Testaccio", versione: 3 });
  expect(inviate.at(-1)).toEqual(inviate[0]);
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");
  expect(nonPreviste).toEqual([]);
});

test("sessione scaduta durante una modifica: si torna al modulo di accesso e il messaggio dice quante tappe non erano salvate", async ({ page }) => {
  // Il server respinge il JWT della PUT e, al rinnovo, anche il refresh token: la sessione è finita
  const { inviate, nonPreviste } = await serverConTappa(page, (route) => route.fulfill(errore(401, "Token non valido")));
  let rinnovi = 0;
  await page.route("**/api/auth/refresh", (route) => {
    rinnovi++;
    return route.fulfill(errore(401, "Sessione scaduta"));
  });
  await apriModifica(page);
  await page.getByLabel("Luogo").fill("Testaccio");

  // Si esce senza conferma (salvare non è più possibile) e il modulo dice quante modifiche non sono arrivate al server
  await expect(page.getByRole("alert")).toHaveText("Sessione scaduta: accedi di nuovo. 1 tappa aveva modifiche non salvate.");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toBeVisible();
  // Una sola prova di rinnovo, poi basta: nessun nuovo tentativo di salvare, e non resta niente della sessione nel browser
  expect(rinnovi).toBe(1);
  expect(inviate).toHaveLength(1);
  expect(await page.evaluate(() => [localStorage.getItem("hoop3x3_token"), localStorage.getItem("hoop3x3_session")])).toEqual([null, null]);
  expect(nonPreviste).toEqual([]);
});

test("sessione già scaduta all'apertura dell'app: si arriva al modulo di accesso con il messaggio, senza tappe perse", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await utenteRegistrato(page); // il browser ricorda Anna...
  // ...ma il server respinge il suo JWT e anche il refresh token
  await page.route("**/api/auth/me", (route) => route.fulfill(errore(401, "Sessione scaduta")));
  await page.route("**/api/auth/refresh", (route) => route.fulfill(errore(401, "Sessione scaduta")));
  await page.goto("/lega");

  // Nessuna modifica in attesa: il messaggio è solo «Sessione scaduta», senza il conteggio delle tappe
  await expect(page.getByRole("alert")).toHaveText("Sessione scaduta: accedi di nuovo");
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem("hoop3x3_token"), localStorage.getItem("hoop3x3_session")])).toEqual([null, null]);
  expect(nonPreviste).toEqual([]);
});
