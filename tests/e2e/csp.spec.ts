import { test, expect } from "@playwright/test";
import { json, rispondiAlRisveglio, ID, tappaPubblica } from "./helpers";

/* La Content-Security-Policy di produzione (render.yaml) è la stessa che `vite preview` manda qui (vite.config.ts): una pagina
 * con tutto ciò che l'app carica dall'esterno (font di Google, il logo di una squadra da un host qualsiasi, l'embed di YouTube)
 * deve disegnarsi senza violazioni. Una risorsa nuova che la policy non ammette fa fallire questo test prima del deploy. */

/** Un PNG di 1×1 pixel: il logo che l'host esterno finto restituisce */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64",
);

test("la pagina pubblica di una tappa con logo esterno e video di YouTube si disegna senza violazioni della CSP", async ({ page }) => {
  const violazioni: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violazioni.push(m.text()); });
  await rispondiAlRisveglio(page);
  await page.route(`**/api/archivio/${ID}`, (route) => route.fulfill(json(tappaPubblica)));
  // Gli host esterni non si raggiungono davvero: l'immagine e l'embed li serve il test. Il browser applica comunque la CSP a queste
  // richieste, quindi una direttiva troppo stretta si vede lo stesso
  await page.route("https://loghi.esempio.it/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }));
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>embed</title><p>video</p>" }));

  const risposta = await page.goto(`/tappa/${ID}`);
  expect(risposta?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("heading", { name: "Roma Open" })).toBeVisible();
  // Il logo esterno è caricato (non bloccato da img-src) e l'embed senza cookie è nel frame ammesso
  const logo = page.getByAltText("Logo Falchi").first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator("iframe[src^='https://www.youtube-nocookie.com/embed/abcdefghijk']")).toHaveCount(1);
  // I font di Google sono ammessi: la pagina non ha segnalato niente
  await page.waitForTimeout(300);
  expect(violazioni).toEqual([]);
});
