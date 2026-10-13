import { test, expect } from "@playwright/test";
import { accedi } from "../e2e/helpers";
import { registraUtenteNuovo, sembraUnJwt, tokenSalvato } from "./helpers";

/* Profilo dell'utente con il backend vero: nome, password, richiesta del cambio email ed eliminazione dell'account. Le regole
 * (password attuale, sessioni chiuse, che cosa sparisce) le applica il server. Il server dei test non ha Brevo: la richiesta del
 * cambio email risponde 200 lo stesso e l'email non parte (la conferma dal link si prova nei test del backend, con l'email finta).
 * Questi test passano in CI solo dopo l'unione della PR del backend della fase 6 (il job compila il jar da main). */

test("profilo: nome, password, richiesta di cambio email ed eliminazione dell'account", async ({ page }) => {
  test.setTimeout(90_000);
  const { email, password } = await registraUtenteNuovo(page);
  const nuovaPassword = "nuova-password-1";

  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Profilo" }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  await expect(page.getByRole("heading", { name: "Il tuo account" })).toBeVisible();

  // Nome: vale subito nell'intestazione e sul server (dopo il ricaricamento l'utente si rilegge da lì)
  await page.getByRole("textbox", { name: "Nome utente" }).fill("Anna Rossi");
  await page.getByRole("button", { name: "Salva il nome" }).click();
  await expect(page.getByRole("status")).toHaveText("Nome aggiornato.");
  await expect(page.locator("header").getByText("Anna Rossi", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("header").getByText("Anna Rossi", { exact: true })).toBeVisible();

  // Password: quella attuale sbagliata è respinta con il messaggio del server e i campi restano; poi si cambia davvero
  const schedaPassword = page.getByRole("region", { name: "Password" });
  await schedaPassword.getByLabel("Password attuale").fill("password-sbagliata");
  await schedaPassword.getByLabel("Nuova password").fill(nuovaPassword);
  await schedaPassword.getByLabel("Ripeti la password").fill(nuovaPassword);
  await schedaPassword.getByRole("button", { name: "Cambia la password" }).click();
  await expect(schedaPassword.getByRole("alert")).toHaveText("La password attuale non è corretta");
  await expect(schedaPassword.getByLabel("Nuova password")).toHaveValue(nuovaPassword);
  const tokenPrima = await tokenSalvato(page);
  await schedaPassword.getByLabel("Password attuale").fill(password);
  await schedaPassword.getByRole("button", { name: "Cambia la password" }).click();
  await expect(schedaPassword.getByRole("status")).toContainText("Password aggiornata");
  // Il JWT nuovo è un JWT del server e ha sostituito quello di prima
  const tokenDopo = await tokenSalvato(page);
  expect(sembraUnJwt(tokenDopo)).toBe(true);
  expect(tokenDopo).not.toBe(tokenPrima);

  // Con la vecchia password non si entra più; con la nuova sì
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await accedi(page, email, password);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await tokenSalvato(page)).toBeNull();
  await accedi(page, email, nuovaPassword);
  await expect(page).toHaveURL(/\/leghe$/);

  // Cambio email: il server risponde col suo messaggio (l'email non parte senza Brevo) e l'email dell'account resta quella di prima
  await page.getByRole("navigation", { name: "Principale" }).getByRole("link", { name: "Profilo" }).click();
  const scheda = page.getByRole("region", { name: "Email" });
  await scheda.getByLabel("Nuova email").fill(`nuova-${email}`);
  await scheda.getByLabel("Password attuale").fill(nuovaPassword);
  await scheda.getByRole("button", { name: "Invia il link di conferma" }).click();
  await expect(scheda.getByRole("status")).toContainText("link al nuovo indirizzo");
  await expect(scheda.getByText(email, { exact: true })).toBeVisible();

  // Eliminazione: home con «Account eliminato.», niente nel browser, e le credenziali non entrano più
  const elimina = page.getByRole("region", { name: "Elimina account" });
  await elimina.getByLabel("Password attuale").fill(nuovaPassword);
  await elimina.getByRole("button", { name: "Elimina il mio account" }).click();
  await page.getByRole("alertdialog", { name: "Eliminare l'account?" }).getByRole("button", { name: "Conferma" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("alert")).toHaveText("Account eliminato.");
  expect(await tokenSalvato(page)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("hoop3x3_session"))).toBeNull();

  await accedi(page, email, nuovaPassword);
  await expect(page.getByRole("alert").filter({ hasNotText: "Account eliminato." })).toBeVisible();
  await expect(page).not.toHaveURL(/\/leghe$/);
  expect(await tokenSalvato(page)).toBeNull();
});
