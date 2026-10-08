import { expect, type Locator, type Page, type Route } from "@playwright/test";

/** Entra come Ospite e crea una lega: è il punto di partenza di tutti i percorsi sulle tappe.
 *  (Un ospite nuovo non ha leghe, quindi dopo l'accesso l'app mostra l'elenco /leghe.) */
export async function ospiteConLega(page: Page, nome = "Lega di prova") {
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await page.getByLabel(/Nome della nuova lega/i).fill(nome);
  await page.getByRole("button", { name: /Crea lega/i }).click();
  await expect(page).toHaveURL(/\/lega$/);
}

/** Una tappa con 4 squadre in 2 gironi (una partita per girone) e il sorteggio fatto: bastano due risultati per arrivare al tabellone.
 *  Parte da `ospiteConLega`. */
export async function tappaConDuePartite(page: Page) {
  await ospiteConLega(page);
  await page.getByLabel("Numero squadre").fill("4");
  await page.getByLabel("Numero gironi").fill("2");
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByRole("button", { name: /Sorteggio casuale/i }).click();
}

/** Scrive 21 a 15 nei due campi del primo match ancora aperto (`.scorein`, in ordine nel DOM): vince la squadra A */
async function scriviPunteggio(page: Page) {
  await page.locator("input.scorein").nth(0).fill("21");
  await page.locator("input.scorein").nth(1).fill("15");
}

/** Scrive il risultato della prima partita ancora aperta di un girone e lo salva */
export async function salvaPrimaPartitaAperta(page: Page) {
  await scriviPunteggio(page);
  await page.getByRole("button", { name: /Salva risultato/i }).first().click();
}

/** Scrive il risultato del primo match del tabellone ancora aperto (con le due squadre già note) e lo salva. A gironi finiti i
 *  campi del punteggio sono solo quelli del tabellone, il cui pulsante si chiama «Salva», non «Salva risultato» */
export async function salvaPrimoMatchDelTabellone(page: Page) {
  await scriviPunteggio(page);
  await page.getByRole("button", { name: "Salva", exact: true }).first().click();
}

/** Una risposta JSON del server finto */
export const json = (corpo: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });

/** Una risposta JSON del server finto a una creazione: 201, come quello vero (lega, tappa, registrazione, anagrafe) */
export const creato = (corpo: unknown) => ({ ...json(corpo), status: 201 });

/** Risposta di errore del server finto, nel formato {message, timestamp} che manda quello vero */
export const errore = (status: number, message: string) => ({
  status, contentType: "application/json", body: JSON.stringify({ message, timestamp: 1 }),
});

/** Risponde alla chiamata con cui l'app, all'avvio, sveglia il backend (svegliaServer). Senza, passa dal proxy di Vite, che con il
 *  backend spento stampa un errore a ogni test */
export const rispondiAlRisveglio = (page: Page) =>
  page.route("**/actuator/health", (route) => route.fulfill(json({ status: "UP" })));

/** Impedisce che una chiamata a /api arrivi al backend (cioè al proxy di Vite): quelle a cui il test non ha dato una risposta finta
 *  ricevono 404 e si annotano, così a fine test si controlla che non ce ne siano state. Va chiamata PRIMA delle risposte finte: tra
 *  più rotte che combaciano vince l'ultima registrata.
 *  @returns l'elenco, che si riempie man mano, delle chiamate non previste ("GET /api/...") */
export async function bloccaApiNonPreviste(page: Page): Promise<string[]> {
  const nonPreviste: string[] = [];
  await page.route("**/api/**", (route) => {
    const richiesta = route.request();
    nonPreviste.push(`${richiesta.method()} ${new URL(richiesta.url()).pathname}`);
    return route.fulfill(errore(404, "Chiamata non prevista dal test"));
  });
  return nonPreviste;
}

/** Anna, l'utente registrato dei test: utenteRegistrato la mette già nel browser, il login finto la manda al modulo di accesso */
export const utenteAnna = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" };

/** Un JWT finto che scade nel 2100, così il client non lo rinnova: del token conta solo `exp` nel payload */
export const tokenFinto = `x.${btoa(JSON.stringify({ exp: 4102444800 }))}.x`;

/** Un giocatore dell'anagrafe, scritto da Anna (id "u1", l'utente di `utenteRegistrato`): lei può modificarlo ed eliminarlo */
export function giocatoreDiAnna(id: string, nome: string, cognome: string) {
  return {
    id, nome, cognome, soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "", peso: "", ruolo: "Guardia",
    numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
  };
}

/** Una squadra dell'anagrafe, scritta da Anna */
export function squadraDiAnna(id: string, nome: string) {
  return {
    id, nome, citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
    autore: "Anna", autoreId: "u1", ts: 1,
  };
}

/** Un utente registrato (Anna) senza il backend: la sessione e il token stanno già nel browser (tokenFinto, che non si rinnova) e le
 *  risposte del server le decide il test. Le leghe sono vuote; l'anagrafe è quella passata. Va chiamata prima di aprire la pagina. */
export async function utenteRegistrato(page: Page, anagrafe: { giocatori?: unknown[]; squadre?: unknown[] } = {}) {
  // All'avvio con una sessione salvata l'app aspetta che il server risponda prima di verificarla
  await rispondiAlRisveglio(page);
  await page.addInitScript(([u, token]) => {
    localStorage.setItem("hoop3x3_token", token);
    localStorage.setItem("hoop3x3_session", JSON.stringify({ ...u, guest: false }));
  }, [utenteAnna, tokenFinto] as const);
  await page.route("**/api/auth/me", (route) => route.fulfill(json(utenteAnna)));
  await page.route("**/api/leghe", (route) => route.fulfill(json([])));
  await page.route("**/api/anagrafe/giocatori", (route) => route.fulfill(json(anagrafe.giocatori ?? [])));
  await page.route("**/api/anagrafe/squadre", (route) => route.fulfill(json(anagrafe.squadre ?? [])));
}

/** Dal modulo di accesso della home: sceglie la scheda «Accedi», scrive mail e password e invia */
export async function accedi(page: Page, mail: string, password: string) {
  await page.getByRole("button", { name: "Accedi", exact: true }).first().click(); // la scheda «Accedi» del modulo
  await page.getByLabel("Mail").fill(mail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).last().click(); // il pulsante di invio
}

/** La tappa «Roma Open» (id "t1") come la manda il server, con il luogo e la versione che le dà il test */
export const tappaSulServer = (luogo: string, versione: number) => ({
  id: "t1", nome: "Roma Open", luogo, data: "", nGironi: 1, regole: { target: 21, durata: 10, ot: 2, shot: 12 }, squadre: [], gironi: null,
  partite: [], video: [], conclusa: false, bracket: null, versione,
});

/** Il server di Anna, che ha già la lega «Circuito» con la tappa «Roma Open». Va chiamata prima di aprire la pagina.
 *  `salva` risponde a ogni PUT della tappa; `tappa` dà la tappa com'è sul server quando l'app legge la lega (di default «Roma», versione
 *  3): il test la cambia per far salvare la tappa a un altro dispositivo.
 *  @returns i corpi delle PUT ricevute (anche quelle andate male) e le chiamate a /api senza risposta finta */
export async function serverConTappa(
  page: Page,
  { salva, tappa = () => tappaSulServer("Roma", 3) }: { salva: (route: Route) => Promise<void>; tappa?: () => unknown },
) {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await utenteRegistrato(page); // sessione di Anna nel browser, me e anagrafe (più un elenco di leghe vuoto, sostituito qui sotto)
  // L'ultima lega aperta è «Circuito»: al caricamento l'app la legge dal server
  await page.addInitScript(() => localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1"));
  await page.route("**/api/leghe", (route) => route.fulfill(json([{ id: "l1", nome: "Circuito", ts: 1, nTappe: 1 }])));
  await page.route("**/api/leghe/l1", (route) => route.fulfill(json({ id: "l1", nome: "Circuito", tappe: [tappa()] })));
  const inviate: unknown[] = [];
  await page.route("**/api/tappe/t1", (route) => {
    inviate.push(route.request().postDataJSON());
    return salva(route);
  });
  return { inviate, nonPreviste };
}

/** Apre la pagina della tappa e il pannello «Modifica», dove si scrive il luogo: ogni modifica parte da qui verso il server */
export async function apriModifica(page: Page) {
  await page.goto("/lega/tappa/t1");
  await page.getByRole("button", { name: "Modifica" }).click();
}

/** Preme Tab finché `elemento` ha il focus, come chi usa la tastiera; fallisce se non ci arriva entro `max` pressioni */
export async function tabFinoA(page: Page, elemento: Locator, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await elemento.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Con Tab non si arriva a ${elemento} in ${max} pressioni`);
}
