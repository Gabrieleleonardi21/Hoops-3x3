import { test, expect } from "@playwright/test";
import {
  accedi, apriModifica, bloccaApiNonPreviste, creato, errore, json, rispondiAlRisveglio, serverConTappa, tappaSulServer, tokenFinto,
  utenteAnna, utenteRegistrato,
} from "./helpers";

/* Percorso dell'utente registrato, con il server finto (page.route). Lo stesso percorso con il backend vero sta in
 * tests/e2e-backend/lega-e-tappa.spec.ts, che fissa il contratto imitato qui: le creazioni rispondono 201, la prima versione di una
 * tappa è 0 e ogni PUT la aumenta di uno. Ogni test chiude controllando che nessuna chiamata a /api sia rimasta senza risposta finta,
 * cioè che niente sia arrivato al proxy di Vite. Il 409 della tappa lo prova conflitto-tappa, i 503 delle pagine errori-visibili. */

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
    return route.fulfill(json({ token: tokenFinto, user: utenteAnna }));
  });
  await page.route("**/api/leghe", (route) => {
    if (route.request().method() !== "POST") return route.fulfill(json([]));
    const corpo = route.request().postDataJSON();
    leghe.push(corpo);
    return route.fulfill(creato({ id: "l1", nome: corpo.nome, ts: 1, nTappe: 0 }));
  });
  await page.route("**/api/leghe/l1/tappe", (route) => {
    const corpo = route.request().postDataJSON();
    tappeCreate.push(corpo);
    return route.fulfill(creato({ ...corpo, versione: 0 })); // la prima versione la decide il server, ed è 0
  });
  await page.route("**/api/tappe/*", (route) => {
    const corpo = route.request().postDataJSON();
    tappeSalvate.push(corpo);
    return route.fulfill(json({ ...corpo, versione: corpo.versione + 1 })); // ogni PUT riuscita la aumenta di uno
  });
  await page.route("**/api/anagrafe/**", (route) => route.fulfill(json([])));

  // Accesso dal modulo: le credenziali arrivano al server, l'utente entra e il token resta nel browser
  await page.goto("/");
  await accedi(page, "anna@example.it", "password-lunga");
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

  // Una modifica successiva è una PUT sulla stessa tappa, con la versione che il server ha dato alla creazione (0)
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Luogo").fill("Testaccio");
  await expect.poll(() => tappeSalvate.length).toBe(1);
  expect(tappeSalvate[0]).toMatchObject({ id: (tappeCreate[0] as { id: string }).id, nome: "Roma Open", luogo: "Testaccio", versione: 0 });

  // Tutto è andato a buon fine: nessun avviso, e il luogo è ancora sullo schermo
  await expect(page.getByText(/modifiche non salvate/)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");
  expect(nonPreviste).toEqual([]);
});

test("rete assente al salvataggio: l'avviso dice quante tappe aspettano e perché, e dopo il nuovo tentativo sparisce con la tappa salvata", async ({ page }) => {
  // L'orologio della pagina parte da un istante noto e si ferma prima della modifica: la coda ritenterebbe da sola dopo 2 secondi, e
  // l'avviso potrebbe sparire prima che il test lo guardi. Così il tempo lo muove solo il test, e il nuovo tentativo è il clic
  await page.clock.install({ time: new Date("2026-10-07T10:00:00Z") });
  let tentativi = 0;
  const { inviate, nonPreviste } = await serverConTappa(page, {
    salva: (route) => {
      // Il primo tentativo non trova il server, dal secondo risponde
      tentativi++;
      if (tentativi === 1) return route.abort("failed");
      return route.fulfill(json(tappaSulServer("Testaccio", 4)));
    },
  });
  await apriModifica(page);
  await page.clock.pauseAt(new Date("2026-10-07T10:10:00Z"));
  await page.getByLabel("Luogo").fill("Testaccio");
  await page.clock.runFor(400); // l'attesa prima del salvataggio: 400 ms senza altre modifiche

  // Il server non risponde: l'avviso dice che la tappa non è salvata e il motivo, e ciò che si è scritto resta sullo schermo
  const avviso = page.getByRole("status");
  await expect(avviso).toContainText("1 tappa ha modifiche non salvate");
  await expect(avviso).toContainText("Server non raggiungibile: controlla la connessione o avvia il backend.");
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");

  // Un nuovo tentativo salva la tappa e l'avviso scompare
  await avviso.getByRole("button", { name: "Riprova ora" }).click();
  await expect(avviso).toHaveCount(0);

  // I due tentativi hanno mandato la stessa tappa con la versione letta: niente si è perso né cambiato
  expect(inviate).toHaveLength(2);
  expect(inviate[0]).toMatchObject({ id: "t1", luogo: "Testaccio", versione: 3 });
  expect(inviate[1]).toEqual(inviate[0]);
  await expect(page.getByLabel("Luogo")).toHaveValue("Testaccio");
  expect(nonPreviste).toEqual([]);
});

test("sessione scaduta durante una modifica: si torna al modulo di accesso, il messaggio dice quante tappe non erano salvate e la coda non riprova", async ({ page }) => {
  // L'orologio della pagina si può spostare avanti: serve a far passare le attese dei ritentativi della coda senza aspettarle
  await page.clock.install();
  // Il server respinge il JWT della PUT e, al rinnovo, anche il refresh token: la sessione è finita
  const { inviate, nonPreviste } = await serverConTappa(page, { salva: (route) => route.fulfill(errore(401, "Token non valido")) });
  let rinnovi = 0;
  await page.route("**/api/auth/refresh", (route) => {
    rinnovi++;
    return route.fulfill(errore(401, "Sessione scaduta"));
  });
  await page.route("**/api/barriera", (route) => route.fulfill(json({})));
  await apriModifica(page);
  await page.getByLabel("Luogo").fill("Testaccio");

  // Si esce senza conferma (salvare non è più possibile) e il modulo dice quante modifiche non sono arrivate al server
  await expect(page.getByRole("alert")).toHaveText("Sessione scaduta: accedi di nuovo. 1 tappa aveva modifiche non salvate.");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toBeVisible();

  // La coda avrebbe ritentato dopo 2, 5 e 15 secondi se l'uscita non l'avesse azzerata: l'orologio va oltre tutte le attese. Una
  // richiesta fatta dopo (la «barriera») passa dalle rotte dopo quelle già partite, quindi un ritentativo si sarebbe già visto
  await page.clock.runFor(30_000);
  await page.evaluate(() => fetch("/api/barriera"));
  expect(inviate).toHaveLength(1);
  expect(rinnovi).toBe(1); // una sola prova di rinnovo, poi basta
  // Non resta niente della sessione nel browser
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
