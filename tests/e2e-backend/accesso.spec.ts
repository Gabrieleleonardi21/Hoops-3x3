import { test, expect } from "@playwright/test";
import { accedi } from "../e2e/helpers";
import { registraUtenteNuovo, sembraUnJwt, tokenSalvato } from "./helpers";

/* Registrazione, uscita e accesso con il backend vero: le credenziali le controlla il server (BCrypt), il JWT lo emette lui. */

test("registrazione, uscita e nuovo accesso; una password sbagliata e un'email già registrata sono respinte con il messaggio del server", async ({ page }) => {
  const { email, password } = await registraUtenteNuovo(page);
  await expect(page.getByRole("button", { name: "Esci", exact: true })).toBeVisible();
  expect(sembraUnJwt(await tokenSalvato(page))).toBe(true);

  // Uscita: la sessione sparisce dal browser e si torna al modulo
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toBeVisible();
  expect(await tokenSalvato(page)).toBeNull();

  // Password sbagliata: il server risponde 401 e il modulo lo mostra, senza entrare
  await accedi(page, email, "password-sbagliata");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).not.toHaveURL(/\/leghe$/);
  expect(await tokenSalvato(page)).toBeNull();

  // Credenziali giuste: si entra con un JWT nuovo
  await accedi(page, email, password);
  await expect(page).toHaveURL(/\/leghe$/);
  expect(sembraUnJwt(await tokenSalvato(page))).toBe(true);

  // La stessa email non si registra due volte: 409 dal server, con il suo messaggio
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await page.getByRole("button", { name: "Registrati", exact: true }).click();
  await page.getByLabel("Nome utente").fill("Anna");
  await page.getByLabel("Mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("già registrata");
  await expect(page).not.toHaveURL(/\/leghe$/);
});
