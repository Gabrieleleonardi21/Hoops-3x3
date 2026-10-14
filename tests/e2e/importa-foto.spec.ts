import { test, expect, type Page } from "@playwright/test";
import { bloccaApiNonPreviste, creato, errore, json, ospiteConLega, utenteRegistrato } from "./helpers";

/* «Importa file» con la foto di un foglio, sulla build di produzione (vite preview, con la CSP vera): la riduzione con il canvas è
 * quella del browser, la lettura del server è finta (page.route su POST /api/coach/foglio). La foto è un JPEG vero di 64×48 px. */

const FOTO = "tests/e2e/fixtures/foglio.jpg";

/** Il campo file nascosto di «Importa file» (uno solo nella pagina) */
const campoFile = (page: Page) => page.locator("input[type=file]");

/** La bozza che il server finto «legge» sulla foto: 4 squadre in 2 gironi, due risultati e un dubbio */
const BOZZA = {
  nome: "Tappa di Roma", luogo: "Campo Testaccio", data: "2026-06-14",
  squadre: ["Alfa", "Beta", "Gamma", "Delta"].map((nome) => ({ nome, giocatori: [`${nome} Uno`, `${nome} Due`, `${nome} Tre`] })),
  gironi: [["Alfa", "Beta"], ["Gamma", "Delta"]],
  partite: [{ a: "Alfa", b: "Beta", puntiA: 21, puntiB: 15 }, { a: "Delta", b: "Gamma", puntiA: 12, puntiB: 21 }],
  dubbi: ["Squadra Alfa: il nome potrebbe essere Alpha"],
};

/** Anna, registrata, con la lega «Circuito» aperta (senza tappe). Il server finto crea la lega importata («l2») e annota i corpi.
 *  @returns le leghe create (corpi delle POST) e le chiamate a /api che il test non aspettava */
async function annaConLega(page: Page) {
  const nonPreviste = await bloccaApiNonPreviste(page);
  await utenteRegistrato(page);
  await page.addInitScript(() => localStorage.setItem("hoop3x3_active_lega_id_registrato", "l1"));
  const legheCreate: { nome: string; tappe: { nome: string }[] }[] = [];
  await page.route("**/api/leghe", (route) => {
    if (route.request().method() !== "POST") return route.fulfill(json([{ id: "l1", nome: "Circuito", ts: 1, nTappe: 0 }]));
    const corpo = route.request().postDataJSON();
    legheCreate.push(corpo);
    return route.fulfill(creato({ id: "l2", nome: corpo.nome, ts: 2, nTappe: corpo.tappe.length }));
  });
  await page.route("**/api/leghe/l1", (route) => route.fulfill(json({ id: "l1", nome: "Circuito", tappe: [] })));
  await page.goto("/lega");
  await expect(page.getByRole("heading", { name: "Le tappe del circuito" })).toBeVisible();
  return { legheCreate, nonPreviste };
}

test("una foto letta diventa una lega con la sua tappa; la finestra mostra i dubbi e «Apri il Coach» li passa al Coach", async ({ page }) => {
  const { legheCreate, nonPreviste } = await annaConLega(page);
  // La risposta del lettore aspetta il via del test: così si vede lo stato della lettura
  let via: () => void = () => {};
  const attesa = new Promise<void>((r) => { via = r; });
  const immagini: string[] = [];
  await page.route("**/api/coach/foglio", async (route) => {
    immagini.push(route.request().postDataJSON().immagine);
    await attesa;
    await route.fulfill(json(BOZZA));
  });

  await campoFile(page).setInputFiles(FOTO);
  await expect(page.getByText("Lettura del foglio 1 di 1…")).toBeVisible();
  await expect(page.getByRole("button", { name: /Importa file/ })).toBeDisabled();
  via();

  const finestra = page.getByRole("alertdialog", { name: "Tappa importata dal foglio" });
  await expect(finestra).toContainText("Squadra Alfa: il nome potrebbe essere Alpha");
  await expect(finestra).toContainText("Vuoi passarla al Coach AI per le correzioni?");
  // La foto è partita ridotta nel browser, come data URL JPEG (la CSP ammette data:, non blob:)
  expect(immagini).toHaveLength(1);
  expect(immagini[0]).toMatch(/^data:image\/jpeg;base64,/);
  // Una lega nuova con la tappa letta, i suoi risultati e il nome della tappa
  expect(legheCreate).toHaveLength(1);
  expect(legheCreate[0].nome).toBe("Tappa di Roma");
  expect(legheCreate[0].tappe.map((t) => t.nome)).toEqual(["Tappa di Roma"]);

  await finestra.getByRole("button", { name: "Apri il Coach" }).click();
  await expect(finestra).toHaveCount(0);
  const coach = page.getByRole("dialog", { name: "Coach AI" });
  await expect(coach).toContainText("Ho importato dal foglio la tappa «Tappa di Roma» nella lega «Tappa di Roma».");
  await expect(coach).toContainText("Squadra Alfa: il nome potrebbe essere Alpha");
  // La pagina della lega mostra la tappa importata
  await expect(page.getByText("Tappa di Roma").first()).toBeVisible();
  expect(nonPreviste).toEqual([]);
});

test("il lettore non disponibile (502): il messaggio nomina la foto e il motivo, e nessuna lega nasce", async ({ page }) => {
  const { legheCreate, nonPreviste } = await annaConLega(page);
  await page.route("**/api/coach/foglio",
    (route) => route.fulfill(errore(502, "Il lettore dei fogli non è disponibile in questo momento")));

  await campoFile(page).setInputFiles(FOTO);
  await expect(page.getByRole("alert")).toHaveText(
    "Import non riuscito: Foto «foglio.jpg»: Il lettore dei fogli non è disponibile in questo momento",
  );
  expect(legheCreate).toEqual([]);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Importa file/ })).toBeEnabled();
  expect(nonPreviste).toEqual([]);
});

test("un file di testo rinominato .jpg non è una foto: il messaggio lo dice e niente parte", async ({ page }) => {
  await ospiteConLega(page);
  let lettureChieste = 0;
  await page.route("**/api/coach/foglio", (route) => {
    lettureChieste++;
    return route.fulfill(errore(500, "non doveva partire"));
  });
  // Il file si costruisce nella pagina (File e DataTransfer), come in importa-lega.spec.ts
  await campoFile(page).evaluate((campo) => {
    const dati = new DataTransfer();
    dati.items.add(new File(["non sono una foto"], "foglio.jpg", { type: "image/jpeg" }));
    (campo as HTMLInputElement).files = dati.files;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Import non riuscito: Il file «foglio.jpg» non è un JSON di HOOP 3X3 né una foto JPEG, PNG o WebP "
    + "(una foto HEIC va salvata come JPEG).",
  );
  expect(lettureChieste).toBe(0);
});
