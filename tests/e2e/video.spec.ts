import { test, expect, type Page } from "@playwright/test";
import { json, rispondiAlRisveglio, ID, tappaPubblica } from "./helpers";

/* Il video sotto la tappa prende tutta la larghezza della colonna, resta 16:9 e non supera l'altezza dello schermo.
 * Il test guarda le misure del riquadro, non le classi. */

const EMBED = "iframe[src^='https://www.youtube-nocookie.com/embed/']";

/** Apre la tappa pubblica finta (con un video) alla misura di schermo data e dà il riquadro del video */
async function misuraVideo(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await rispondiAlRisveglio(page);
  await page.route(`**/api/archivio/${ID}`, (route) => route.fulfill(json(tappaPubblica)));
  // Gli host esterni non si raggiungono: l'embed e il logo li serve il test
  await page.route("https://loghi.esempio.it/**", (route) => route.abort());
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>embed</title><p>video</p>" }));
  await page.goto(`/tappa/${ID}`);
  const iframe = page.locator(EMBED);
  await expect(iframe).toHaveCount(1);
  await iframe.scrollIntoViewIfNeeded();
  const box = await iframe.boundingBox();
  if (!box) throw new Error("Il video non ha un riquadro");
  return box;
}

test("a 1280×800 il video prende la larghezza della pagina e sta nello schermo", async ({ page }) => {
  const box = await misuraVideo(page, 1280, 800);
  expect(box.width).toBeGreaterThanOrEqual(900);
  expect(box.height).toBeLessThanOrEqual(800 - 60);
});

test("a 1280×600 il video resta 16:9 e sotto l'altezza dello schermo", async ({ page }) => {
  const box = await misuraVideo(page, 1280, 600);
  expect(box.height).toBeLessThanOrEqual(600 - 60);
  expect(box.width / box.height).toBeGreaterThan(1.7);
  expect(box.width / box.height).toBeLessThan(1.8);
});

test("sul telefono il video prende tutta la larghezza meno i bordi", async ({ page }) => {
  const box = await misuraVideo(page, 375, 812);
  expect(box.width).toBeGreaterThanOrEqual(341);
  expect(box.width).toBeLessThanOrEqual(345);
});

test("in stampa il video non compare (a tutta larghezza stamperebbe una pagina bianca)", async ({ page }) => {
  await misuraVideo(page, 1280, 800);
  await expect(page.locator(EMBED)).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(EMBED)).toBeHidden();
});
