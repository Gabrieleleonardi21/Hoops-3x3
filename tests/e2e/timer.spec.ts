import { test, expect } from "@playwright/test";
import { ospiteConLega } from "./helpers";

// Come ospite: tutto resta nel browser. La pagina della tappa scarica l'anagrafe, la cui risposta la decide il test (il backend non c'è)
test.beforeEach(async ({ page }) => {
  await page.route("**/api/anagrafe/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
});

test("il timer di gara usa le regole della tappa, resta giusto con la scheda in secondo piano e si chiude con Esc (FD-7)", async ({ page }) => {
  // Orologio finto del browser: parte da un istante noto e poi lo si ferma e lo si sposta a mano
  await page.clock.install({ time: new Date("2026-10-05T12:00:00Z") });
  await ospiteConLega(page);
  await page.getByRole("button", { name: /Crea la tappa/i }).click();
  await page.getByLabel("Durata (minuti)").fill("2");
  await page.getByLabel("Possesso (secondi)").fill("24");
  await page.getByRole("button", { name: "Timer", exact: true }).click();

  // Le regole scritte nella tappa, non 10 minuti e 12 secondi
  const timer = page.getByRole("dialog", { name: "Timer di gara" });
  await expect(timer.getByText("2:00")).toBeVisible();
  await expect(timer.getByRole("button", { name: "Reset 24s" })).toBeVisible();
  // La pagina sotto non scorre finché la finestra è aperta
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  // L'orologio si ferma a un istante preciso e il timer parte; poi passano 30 secondi in un colpo solo, come con la scheda in
  // secondo piano o il telefono bloccato: gli scatti non arrivano e ne arriva uno solo. Il cronometro mostra comunque il tempo giusto
  await page.clock.pauseAt(new Date("2026-10-05T12:10:00Z"));
  await timer.getByRole("button", { name: "START" }).click();
  await page.clock.fastForward(30_000);
  await expect(timer.getByText("1:30")).toBeVisible();

  // Esc chiude la finestra e lo scorrimento della pagina torna
  await page.keyboard.press("Escape");
  await expect(timer).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});
