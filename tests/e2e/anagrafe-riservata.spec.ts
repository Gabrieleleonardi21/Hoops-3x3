import { test, expect, type Page } from "@playwright/test";
import { accedi, json, tokenFinto, utenteAnna } from "./helpers";

// T2.15: senza account il server manda l'anagrafe con i dati personali vuoti (forma pubblica), con un account manda tutto. Il backend
// finto sceglie la forma dall'header Authorization, come quello vero.

/** Il giocatore com'è senza account: stesse chiavi, campi riservati vuoti e autoreId null */
const pubblico = {
  id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "",
  ruolo: "Guardia", numero: "7", squadra: "", esperienza: "", note: "", autore: "", autoreId: null, ts: 1,
};
/** Lo stesso giocatore com'è con un account, scritto da Anna (id "u1") */
const completo = { ...pubblico, nascita: "1998-03-15", citta: "Roma", nazionalita: "Italia", note: "Tiratore da tre", autore: "Anna", autoreId: "u1" };

/** Server finto: anagrafe nelle due forme, accesso di Anna e nessuna lega. Ricorda la forma di ogni risposta dell'elenco dei giocatori. */
async function serverFinto(page: Page) {
  const formeInviate: ("pubblica" | "completa")[] = [];
  await page.route("**/api/anagrafe/giocatori", (route) => {
    if (route.request().headers()["authorization"]) {
      formeInviate.push("completa");
      return route.fulfill(json([completo]));
    }
    formeInviate.push("pubblica");
    return route.fulfill(json([pubblico]));
  });
  await page.route("**/api/anagrafe/squadre", (route) => route.fulfill(json([])));
  await page.route("**/api/leghe", (route) => route.fulfill(json([])));
  await page.route("**/api/auth/login", (route) => route.fulfill(json({ token: tokenFinto, user: utenteAnna })));
  return formeInviate;
}

/** Apre l'anagrafe dalla navigazione (senza ricaricare la pagina: la cache dello store resta) */
const apriAnagrafe = (page: Page) =>
  page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Anagrafe" }).click();

test("un ospite vede la forma pubblica; dopo l'accesso la stessa pagina mostra i dati completi, senza ricaricare", async ({ page }) => {
  const formeInviate = await serverFinto(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Continua come Ospite/i }).click();
  await apriAnagrafe(page);

  // Forma pubblica: il giocatore c'è, senza «Registrato da» vuoto né righe dei dati personali, e senza comandi di modifica
  await expect(page.getByRole("button", { name: "Mario Rossi" })).toBeVisible();
  await expect(page.getByText(/Registrato da/)).toHaveCount(0);
  await expect(page.getByText(/Nato il/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elimina Mario Rossi" })).toHaveCount(0);
  expect(formeInviate).toEqual(["pubblica"]);

  // L'ospite esce e accede come Anna: la cache dell'anagrafe, in forma pubblica, non deve restare
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await accedi(page, "anna@example.it", "password-lunga");
  await expect(page).toHaveURL(/\/leghe$/);
  await apriAnagrafe(page);

  // Forma completa: arriva con una richiesta nuova che porta il token (la pagina era ancora aperta sull'anagrafe quando l'ospite è
  // uscito, e la cache svuotata si è riscaricata una volta senza token: sempre in forma pubblica, prima di accedere)
  await expect(page.getByText(/Nato il 1998-03-15/)).toBeVisible();
  await expect(page.getByText("Tiratore da tre")).toBeVisible();
  await expect(page.getByText("Registrato da Anna")).toBeVisible();
  await expect(page.getByRole("button", { name: "Elimina Mario Rossi" })).toBeVisible();
  expect(formeInviate.at(-1)).toBe("completa");
  expect(formeInviate.filter((forma) => forma === "completa")).toHaveLength(1);
});
