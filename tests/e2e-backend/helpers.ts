import { expect, type Page } from "@playwright/test";

/* Helper dei test con il backend vero (playwright.backend.config.ts). Niente page.route: le risposte sono quelle del server. */

/** Registra dal modulo della home un utente nuovo, con un'email che non può esistere già (i test condividono il database e non lo
 *  svuotano), e aspetta l'elenco delle leghe. La password è quella dei test con il server finto.
 *  @returns le credenziali, per un nuovo accesso */
export async function registraUtenteNuovo(page: Page) {
  const email = `anna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.it`;
  const password = "password-lunga";
  await page.goto("/");
  await page.getByRole("button", { name: "Registrati", exact: true }).click(); // la scheda «Registrati» del modulo
  await page.getByLabel("Nome utente").fill("Anna");
  await page.getByLabel("Mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(page).toHaveURL(/\/leghe$/);
  return { email, password };
}

/** Il JWT salvato nel browser (null dopo l'uscita) */
export const tokenSalvato = (page: Page) => page.evaluate(() => localStorage.getItem("hoop3x3_token"));

/** true se è un JWT emesso dal server: tre parti separate da un punto, e la seconda è un payload con la scadenza */
export function sembraUnJwt(token: string | null): boolean {
  if (!token) return false;
  const parti = token.split(".");
  if (parti.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parti[1], "base64url").toString());
    return typeof payload.exp === "number";
  } catch {
    return false;
  }
}

/** Sostituisce il JWT nel browser con uno che il server respinge: alla prossima richiesta il client riceve 401 e rinnova con il
 *  cookie di refresh (api.ts, «rinnovo dopo un 401»). È il modo per forzare un rinnovo vero senza aspettare i 30 minuti del JWT */
export const rovinaIlToken = (page: Page) => page.evaluate(() => localStorage.setItem("hoop3x3_token", "x.y.z"));

/** Aspetta la risposta del server a `metodo` su un percorso che combacia con `percorso`. Va chiamata PRIMA dell'azione che
 *  manda la richiesta, altrimenti la risposta può arrivare prima che si cominci ad aspettarla */
export function rispostaA(page: Page, metodo: string, percorso: RegExp) {
  return page.waitForResponse((r) => r.request().method() === metodo && percorso.test(new URL(r.url()).pathname));
}
