import { test, expect, type Page } from "@playwright/test";
import { bloccaApiNonPreviste, errore, json, ospiteConLega, rispondiAlRisveglio, tokenFinto, utenteAnna, utenteRegistrato } from "./helpers";

/* Pagina del profilo con il server finto (page.route su /api/auth/me…). Il contratto imitato è quello del backend della fase 6:
 * PATCH /api/auth/me risponde con l'utente, POST /api/auth/me/password con {token, user}. Ogni test chiude controllando che nessuna
 * chiamata a /api sia rimasta senza risposta finta. Il giro con il backend vero sta in tests/e2e-backend/profilo.spec.ts. */

/** Un secondo JWT finto (anche questo scade nel 2100), quello che il server manda dopo il cambio della password */
const tokenNuovo = `y.${btoa(JSON.stringify({ exp: 4102444800 }))}.y`;

/** Intercetta le chiamate di un metodo su un percorso e lascia passare le altre alle rotte registrate prima (route.fallback) */
async function rispondiA(
  page: Page, percorso: string, metodo: string,
  risposta: (corpo: Record<string, string>, bearer: string | undefined) => ReturnType<typeof json>,
) {
  const ricevute: Record<string, string>[] = [];
  await page.route(percorso, (route) => {
    const richiesta = route.request();
    if (richiesta.method() !== metodo) return route.fallback();
    const corpo = richiesta.postDataJSON() as Record<string, string>;
    ricevute.push(corpo);
    return route.fulfill(risposta(corpo, richiesta.headers().authorization));
  });
  return ricevute;
}

test("cambio del nome: dal menu «Profilo», il PATCH parte con il Bearer e l'intestazione mostra subito il nome nuovo", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await utenteRegistrato(page);
  let bearer: string | undefined;
  const nomi = await rispondiA(page, "**/api/auth/me", "PATCH", (corpo, b) => {
    bearer = b;
    return json({ ...utenteAnna, name: corpo.name });
  });

  await page.goto("/");
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Profilo" }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  await expect(page.getByRole("heading", { name: "Il tuo account" })).toBeVisible();
  // L'email sta sotto il titolo e nella scheda dell'email
  await expect(page.getByText("anna@example.it", { exact: true })).toHaveCount(2);

  await page.getByRole("textbox", { name: "Nome utente" }).fill("Anna Rossi");
  await page.getByRole("button", { name: "Salva il nome" }).click();
  await expect(page.getByRole("status")).toHaveText("Nome aggiornato.");
  await expect(page.locator("header").getByText("Anna Rossi", { exact: true })).toBeVisible();
  expect(nomi).toEqual([{ name: "Anna Rossi" }]);
  expect(bearer).toBe(`Bearer ${tokenFinto}`);
  expect(nonPreviste).toEqual([]);
});

test("un nome troppo corto non parte; un 400 del server compare sotto il form e il campo tiene il testo", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await utenteRegistrato(page);
  await page.route("**/api/auth/me", (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    return route.fulfill(errore(400, "Nome utente non valido"));
  });

  await page.goto("/profilo");
  const campo = page.getByRole("textbox", { name: "Nome utente" });
  await campo.fill("a");
  await page.getByRole("button", { name: "Salva il nome" }).click();
  await expect(page.getByText("Nome utente di almeno 2 caratteri")).toBeVisible();
  await campo.fill("Anna Rossi");
  await page.getByRole("button", { name: "Salva il nome" }).click();
  await expect(page.getByRole("alert")).toHaveText("Nome utente non valido");
  await expect(campo).toHaveValue("Anna Rossi");
  expect(nonPreviste).toEqual([]);
});

test("cambio della password: la richiesta porta le due password e il token nuovo sostituisce quello salvato", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await utenteRegistrato(page);
  const richieste = await rispondiA(page, "**/api/auth/me/password", "POST", () => json({ token: tokenNuovo, user: utenteAnna }));

  await page.goto("/profilo");
  // «Password attuale» c'è anche nella scheda dell'email: si cerca dentro la scheda
  const scheda = page.getByRole("region", { name: "Password" });
  await scheda.getByLabel("Password attuale").fill("vecchia-pass");
  await scheda.getByLabel("Nuova password").fill("nuova-pass-1");
  await scheda.getByLabel("Ripeti la password").fill("nuova-pass-1");
  await scheda.getByRole("button", { name: "Cambia la password" }).click();
  await expect(scheda.getByRole("status")).toHaveText("Password aggiornata. Gli altri dispositivi sono stati scollegati.");
  expect(richieste).toEqual([{ passwordAttuale: "vecchia-pass", nuovaPassword: "nuova-pass-1" }]);
  expect(await page.evaluate(() => localStorage.getItem("hoop3x3_token"))).toBe(tokenNuovo);
  await expect(scheda.getByLabel("Nuova password")).toHaveValue("");
  expect(nonPreviste).toEqual([]);
});

test("l'ospite apre il profilo dal menu: un messaggio chiaro, nessun campo, nessuna richiesta al server", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await ospiteConLega(page);
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Profilo" }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  await expect(page.getByText(/Sei entrato come Ospite: i tuoi dati restano in questo browser e non c'è un account da gestire/)).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
  expect(nonPreviste).toEqual([]);
});

const MESSAGGIO_LINK = "Ti abbiamo inviato un link al nuovo indirizzo: aprilo entro 30 minuti per confermare il cambio.";
const MESSAGGIO_CONFERMA = "Email aggiornata: da ora accedi con il nuovo indirizzo.";

test("cambio dell'email: la richiesta porta nuovo indirizzo e password, il messaggio del server compare e i campi si svuotano", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await utenteRegistrato(page);
  const richieste = await rispondiA(page, "**/api/auth/me/email", "POST", () => json({ message: MESSAGGIO_LINK }));

  await page.goto("/profilo");
  const scheda = page.getByRole("region", { name: "Email" });
  await expect(scheda.getByText("anna@example.it", { exact: true })).toBeVisible();
  await scheda.getByLabel("Nuova email").fill("nuova@example.it");
  await scheda.getByLabel("Password attuale").fill("la-mia-pass");
  await scheda.getByRole("button", { name: "Invia il link di conferma" }).click();
  await expect(scheda.getByRole("status")).toHaveText(MESSAGGIO_LINK);
  expect(richieste).toEqual([{ nuovaEmail: "nuova@example.it", password: "la-mia-pass" }]);
  await expect(scheda.getByLabel("Nuova email")).toHaveValue("");
  await expect(scheda.getByLabel("Password attuale")).toHaveValue("");
  expect(nonPreviste).toEqual([]);
});

test("il link di conferma aperto non manda niente: la POST parte solo al clic, anche senza essere entrati", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  const conferme = await rispondiA(page, "**/api/auth/email/conferma", "POST", () => json({ message: MESSAGGIO_CONFERMA }));

  await page.goto("/conferma-email?token=abc");
  await expect(page.getByText("Stai per confermare il nuovo indirizzo email del tuo account HOOP 3X3.")).toBeVisible();
  // Senza clic nessuna richiesta, nemmeno dopo un ricaricamento: uno scanner della posta che apre il link non consuma il token
  await page.reload();
  await expect(page.getByRole("button", { name: "Conferma l'indirizzo" })).toBeVisible();
  expect(conferme).toEqual([]);
  expect(nonPreviste).toEqual([]);

  await page.getByRole("button", { name: "Conferma l'indirizzo" }).click();
  await expect(page.getByRole("status")).toHaveText(MESSAGGIO_CONFERMA);
  expect(conferme).toEqual([{ token: "abc" }]);
  // Chi non è entrato in questo browser va al modulo d'accesso, già sulla scheda «Accedi»
  await page.getByRole("link", { name: "Accedi", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accedi", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  expect(nonPreviste).toEqual([]);
});

test("link scaduto o indirizzo già preso: il messaggio del server compare com'è", async ({ page }) => {
  await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await page.route("**/api/auth/email/conferma", (route) => route.fulfill(errore(409, "Email nuova@example.it già registrata")));
  await page.goto("/conferma-email?token=abc");
  await page.getByRole("button", { name: "Conferma l'indirizzo" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email nuova@example.it già registrata");
});
