import { test, expect } from "@playwright/test";
import { registraUtenteNuovo, rispostaA, rovinaIlToken, sembraUnJwt, tokenSalvato } from "./helpers";

/* Rinnovo del JWT con il refresh token vero: il cookie httpOnly lo imposta il server e lo rimanda il browser. Il rinnovo si forza
 * sostituendo il JWT nel browser con uno che il server respinge: il client riceve 401, chiama /api/auth/refresh e ripete la
 * richiesta. Il server ruota il refresh token a ogni rinnovo (RefreshTokenService): il secondo rinnovo prova che il cookie nuovo
 * è arrivato al browser e vale. */

// Il JWT rinnovato non si confronta con quello di prima: il payload (sub, iat, exp) ha i secondi, e un rinnovo nello stesso secondo
// dell'accesso dà lo stesso token. Conta che il JWT respinto («x.y.z») sia stato sostituito da uno del server

test("un 401 fa rinnovare il JWT con il cookie di refresh e ripetere la richiesta; dopo la rotazione un secondo rinnovo funziona", async ({ page }) => {
  await registraUtenteNuovo(page);

  // JWT respinto dal server: la creazione della lega riceve 401, il client rinnova e la ripete, e la lega nasce lo stesso
  await rovinaIlToken(page);
  const rinnovo = rispostaA(page, "POST", /^\/api\/auth\/refresh$/);
  await page.getByLabel(/Nome della nuova lega/i).fill("Circuito Roma");
  await page.getByRole("button", { name: /Crea lega/i }).click();
  expect((await rinnovo).status()).toBe(200);
  await expect(page).toHaveURL(/\/lega$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(sembraUnJwt(await tokenSalvato(page))).toBe(true);

  // Secondo rinnovo, all'apertura dell'app: il cookie è quello ruotato dal primo. Con una sessione salvata e un JWT respinto, la
  // verifica all'avvio (/api/auth/me) riceve 401 e rinnova prima di mostrare le leghe
  await rovinaIlToken(page);
  const secondoRinnovo = rispostaA(page, "POST", /^\/api\/auth\/refresh$/);
  await page.goto("/leghe");
  expect((await secondoRinnovo).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Esci", exact: true })).toBeVisible();
  await expect(page.getByText("Circuito Roma")).toBeVisible();
  await expect(page.getByRole("button", { name: /Continua come Ospite/i })).toHaveCount(0);
  expect(sembraUnJwt(await tokenSalvato(page))).toBe(true);
});
