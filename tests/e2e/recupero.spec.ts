import { test, expect } from "@playwright/test";
import { accedi, bloccaApiNonPreviste, errore, json, rispondiAlRisveglio, tokenFinto, utenteAnna } from "./helpers";

/* Recupero della password con il server finto (page.route su /api/auth/password/*): richiesta del link, link della mail simulato
 * aprendo l'indirizzo con il token, nuova password e accesso. Il contratto imitato è quello del backend: la richiesta risponde
 * sempre 200 con lo stesso messaggio; la reimpostazione 200 con il suo, oppure 400 con «Il link non è valido…». La mail vera non
 * si prova qui. */

const MESSAGGIO_RICHIESTA = "Se l'email è registrata, riceverai un link per reimpostare la password.";
const MESSAGGIO_SUCCESSO = "Password aggiornata. Accedi con la nuova password.";
const LINK_NON_VALIDO = "Il link non è valido o è scaduto. Richiedine uno nuovo.";

test("percorso completo: richiesta del link, nuova password dal link della mail, accesso con la nuova password", async ({ page }) => {
  test.setTimeout(30_000);
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  const richieste: unknown[] = [];
  const reimpostazioni: unknown[] = [];
  const accessi: unknown[] = [];
  await page.route("**/api/auth/password/dimenticata", (route) => {
    richieste.push(route.request().postDataJSON());
    return route.fulfill(json({ message: MESSAGGIO_RICHIESTA }));
  });
  await page.route("**/api/auth/password/reimposta", (route) => {
    reimpostazioni.push(route.request().postDataJSON());
    return route.fulfill(json({ message: MESSAGGIO_SUCCESSO }));
  });
  await page.route("**/api/auth/login", (route) => {
    accessi.push(route.request().postDataJSON());
    return route.fulfill(json({ token: tokenFinto, user: utenteAnna }));
  });
  await page.route("**/api/leghe", (route) => route.fulfill(json([])));
  await page.route("**/api/anagrafe/**", (route) => route.fulfill(json([])));

  // Dalla scheda «Accedi» il link porta alla richiesta; il messaggio del server compare e basta
  await page.goto("/");
  await page.getByRole("button", { name: "Accedi", exact: true }).first().click();
  await page.getByRole("link", { name: "Password dimenticata?" }).click();
  await expect(page).toHaveURL(/\/password-dimenticata$/);
  // L'indirizzo cambia prima che la pagina sia disegnata: finché si vede ancora il modulo d'accesso, «Mail» è il suo campo, che il
  // cambio di pagina butta via insieme a ciò che ci si scrive. Si aspetta la pagina nuova prima di scrivere
  await expect(page.getByRole("heading", { name: "Password dimenticata" })).toBeVisible();
  await page.getByLabel("Mail").fill("anna@example.it");
  await page.getByRole("button", { name: "Invia il link" }).click();
  await expect(page.getByText(MESSAGGIO_RICHIESTA)).toBeVisible();
  expect(richieste).toEqual([{ email: "anna@example.it" }]);

  // Il link della mail (simulato): una navigazione completa, come un clic dal programma di posta. Il token arriva al server com'è
  await page.goto("/reimposta-password?token=tok-123");
  await page.getByLabel("Nuova password").fill("nuova-password");
  await page.getByLabel("Ripeti la password").fill("nuova-password");
  await page.getByRole("button", { name: "Imposta la password" }).click();
  await expect(page.getByText(MESSAGGIO_SUCCESSO)).toBeVisible();
  expect(reimpostazioni).toEqual([{ token: "tok-123", nuovaPassword: "nuova-password" }]);

  // «Accedi» porta al modulo già sulla scheda «Accedi», e la nuova password entra
  await page.getByRole("link", { name: "Accedi", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accedi", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  await accedi(page, "anna@example.it", "nuova-password");
  await expect(page).toHaveURL(/\/leghe$/);
  expect(accessi).toEqual([{ email: "anna@example.it", password: "nuova-password" }]);
  expect(nonPreviste).toEqual([]);
});

test("due password diverse non partono; la pagina ricaricata legge ancora il token dall'indirizzo", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await page.goto("/reimposta-password?token=tok-123");
  await page.reload();
  await page.getByLabel("Nuova password").fill("nuova-password");
  await page.getByLabel("Ripeti la password").fill("altra-password");
  await page.getByRole("button", { name: "Imposta la password" }).click();
  await expect(page.getByText("Le due password non coincidono")).toBeVisible();
  expect(nonPreviste).toEqual([]);
});

test("link scaduto o già usato: il messaggio del server e il collegamento per richiederne uno nuovo", async ({ page }) => {
  await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await page.route("**/api/auth/password/reimposta", (route) => route.fulfill(errore(400, LINK_NON_VALIDO)));
  await page.goto("/reimposta-password?token=scaduto");
  await page.getByLabel("Nuova password").fill("nuova-password");
  await page.getByLabel("Ripeti la password").fill("nuova-password");
  await page.getByRole("button", { name: "Imposta la password" }).click();
  await expect(page.getByText(LINK_NON_VALIDO)).toBeVisible();
  await page.getByRole("link", { name: "Richiedi un nuovo link" }).click();
  await expect(page).toHaveURL(/\/password-dimenticata$/);
});

test("senza token nell'indirizzo la pagina dice subito che il link non è valido", async ({ page }) => {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  await page.goto("/reimposta-password");
  await expect(page.getByText("Il link non è valido")).toBeVisible();
  await expect(page.getByLabel("Nuova password")).toHaveCount(0);
  await page.getByRole("link", { name: "Richiedi un nuovo link" }).click();
  await expect(page).toHaveURL(/\/password-dimenticata$/);
  expect(nonPreviste).toEqual([]);
});

test("richiesta del link senza rete: l'errore si vede e «Riprova» rimanda la stessa mail", async ({ page }) => {
  await bloccaApiNonPreviste(page);
  await rispondiAlRisveglio(page);
  let chiamate = 0;
  await page.route("**/api/auth/password/dimenticata", (route) => {
    chiamate += 1;
    if (chiamate === 1) return route.abort("failed");
    return route.fulfill(json({ message: MESSAGGIO_RICHIESTA }));
  });
  await page.goto("/password-dimenticata");
  await page.getByLabel("Mail").fill("anna@example.it");
  await page.getByRole("button", { name: "Invia il link" }).click();
  await expect(page.getByText(/Server non raggiungibile/)).toBeVisible();
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText(MESSAGGIO_RICHIESTA)).toBeVisible();
  expect(chiamate).toBe(2);
});
