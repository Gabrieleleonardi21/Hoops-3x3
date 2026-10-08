// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: lo store è quello vero e scrive nel localStorage di jsdom
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

// Le chiavi come sono nel browser: quella dell'ospite è la storica, quella del registrato ha il suo nome
const CHIAVE_OSPITE = "hoop3x3_active_lega_id";
const CHIAVE_REGISTRATO = "hoop3x3_active_lega_id_registrato";

const tappa = (): Tappa => ({
  id: "t1", nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});

/** Il browser che rifiuta ogni scrittura: lo spazio per il sito è finito (QuotaExceededError), o l'archivio è disattivato */
function browserPieno() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  });
}

/** Il browser che ha posto per `n` scritture e poi rifiuta tutto: lo spazio finisce a metà di un'azione */
function browserPienoDopo(n: number) {
  const scrivi = Storage.prototype.setItem;
  let fatte = 0;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, chiave: string, valore: string) {
    if (fatte >= n) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    fatte++;
    scrivi.call(this, chiave, valore);
  });
}

/** Il browser che rifiuta solo i dati delle leghe (grandi) e accetta il resto, indice compreso (piccolo) */
function browserPienoPerLeLeghe() {
  const scrivi = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, chiave: string, valore: string) {
    if (chiave.startsWith("hoop3x3_lega_")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    scrivi.call(this, chiave, valore);
  });
}

/** Il browser che rifiuta solo i dati di una lega (grandi), e accetta il resto, indice e leghe nuove (piccole) compresi */
function browserPienoPerLaLega(id: string) {
  const scrivi = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, chiave: string, valore: string) {
    if (chiave === `hoop3x3_lega_${id}`) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    scrivi.call(this, chiave, valore);
  });
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({
    user: ospite, legaId: "l1", legaName: "Estate", leghe: [{ id: "l1", nome: "Estate", ts: 1, nTappe: 1 }], tappe: [tappa()], syncError: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  store().reset();
  localStorage.clear();
});

describe("ospite: le scritture su localStorage sono protette (FS-9)", () => {
  it("con lo spazio esaurito una modifica non va in errore: resta in memoria e un avviso dice che non è salvata", () => {
    browserPieno();
    expect(() => store().updateTappa("t1", { nome: "Finale" })).not.toThrow();
    expect(store().tappe[0].nome).toBe("Finale");
    expect(store().syncError).toMatch(/spazio esaurito/i);
  });

  it("anche aggiungere o togliere una tappa, o rinominare la lega, non va in errore", () => {
    browserPieno();
    expect(() => store().addTappa({ ...tappa(), id: "t2" })).not.toThrow();
    expect(() => store().removeTappa("t2")).not.toThrow();
    expect(() => store().setLegaName("Inverno")).not.toThrow();
    expect(store().legaName).toBe("Inverno");
    expect(store().syncError).toMatch(/spazio esaurito/i);
  });

  it("creare o importare una lega senza spazio non crea niente, e l'errore dice che lo spazio è esaurito", async () => {
    browserPieno();
    const prima = { legaId: store().legaId, leghe: store().leghe, tappe: store().tappe };
    await expect(store().createLega("Nuova")).rejects.toMatchObject({ message: expect.stringMatching(/spazio esaurito/i) });
    await expect(store().importLega("Importata", [tappa()])).rejects.toMatchObject({ message: expect.stringMatching(/spazio esaurito/i) });
    expect({ legaId: store().legaId, leghe: store().leghe, tappe: store().tappe }).toEqual(prima);
  });

  it("aprire un'altra lega non va in errore", async () => {
    localStorage.setItem("hoop3x3_lega_l2", JSON.stringify({ nome: "Inverno", tappe: [] }));
    useAppStore.setState({ leghe: [...store().leghe!, { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 }] });
    browserPieno();
    await expect(store().selectLega("l2")).resolves.toBeUndefined();
    expect(store().legaId).toBe("l2");
  });

  it("con lo spazio a disposizione tutto si salva e nessun avviso compare", () => {
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toBeNull();
    expect(JSON.parse(localStorage.getItem("hoop3x3_lega_l1")!).tappe[0].nome).toBe("Finale");
  });
});

describe("ospite: la versione delle tappe (T2.7) non lo riguarda", () => {
  it("modifiche, tappe nuove e import restano nel browser senza versione, e al server non parte niente", async () => {
    store().updateTappa("t1", { nome: "Finale" });
    store().addTappa({ ...tappa(), id: "t2" });
    const tappe = JSON.parse(localStorage.getItem("hoop3x3_lega_l1")!).tappe;
    expect(tappe.map((t: Tappa) => t.nome)).toEqual(["Finale", "Tappa"]);
    expect(tappe.some((t: Tappa) => "versione" in t)).toBe(false);
    await store().importLega("Importata", [{ ...tappa(), id: "t3" }]);
    expect(store().tappe[0]).not.toHaveProperty("versione");
    const legaImportata = JSON.parse(localStorage.getItem(`hoop3x3_lega_${store().legaId}`)!);
    expect(legaImportata.tappe[0]).not.toHaveProperty("versione");
    const rete = vi.mocked(legheApi);
    for (const chiamata of [rete.putTappa, rete.addTappa, rete.get, rete.create]) expect(chiamata).not.toHaveBeenCalled();
  });
});

describe("ospite: creare o importare una lega è tutto o niente (FS-9)", () => {
  /** Le chiavi dei dati delle leghe nel browser (l'indice e la lega aperta hanno un altro nome) */
  const chiaviLega = () => Object.keys(localStorage).filter((k) => k.startsWith("hoop3x3_lega_"));

  it.each([
    ["creare", () => store().createLega("Nuova")],
    ["importare", () => store().importLega("Importata", [tappa()])],
  ])("%s con posto per i dati della lega ma non per l'indice: niente lega orfana nel browser, e l'errore dice «spazio esaurito»", async (_caso, azione) => {
    browserPienoDopo(1); // la prima scrittura (i dati) riesce, la seconda (l'indice) no
    await expect(azione()).rejects.toMatchObject({ status: 507, message: expect.stringMatching(/spazio esaurito/i) });
    expect(chiaviLega()).toEqual([]);
    expect(localStorage.getItem(CHIAVE_OSPITE)).toBeNull();
    expect(localStorage.getItem("hoop3x3_leghe_index")).toBeNull();
    expect(store().legaId).toBe("l1"); // niente è cambiato in memoria
    expect(store().leghe).toHaveLength(1);
  });

  it("con lo spazio a disposizione la lega, l'indice e la lega aperta sono scritti tutti", async () => {
    const id = await store().createLega("Nuova");
    expect(chiaviLega()).toEqual([`hoop3x3_lega_${id}`]);
    expect(JSON.parse(localStorage.getItem("hoop3x3_leghe_index")!).map((m: { id: string }) => m.id)).toContain(id);
    expect(localStorage.getItem(CHIAVE_OSPITE)).toBe(id);
  });
});

describe("ospite: con le modifiche non salvate, aprire, creare o importare un'altra lega non le perde (FS-9)", () => {
  /** La lega aperta com'era salvata nel browser prima della modifica: una versione vecchia, che aprendola sostituirebbe quella in memoria */
  const versioneVecchia = () => {
    localStorage.setItem("hoop3x3_lega_l1", JSON.stringify({ nome: "Estate", tappe: [tappa()] }));
    localStorage.setItem("hoop3x3_leghe_index", JSON.stringify(store().leghe));
  };
  const nomeSalvato = () => JSON.parse(localStorage.getItem("hoop3x3_lega_l1")!).tappe[0].nome;
  /** Una modifica che non si riesce a salvare: l'avviso c'è e la lega aperta è solo in memoria */
  const modificaNonSalvata = () => {
    const pieno = browserPieno();
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toMatch(/spazio esaurito/i);
    return pieno;
  };

  it("«Apri» sulla stessa lega con lo spazio ancora pieno: errore, modifiche in memoria intatte e avviso ancora lì", async () => {
    versioneVecchia();
    modificaNonSalvata();
    const tappeInMemoria = store().tappe;
    await expect(store().selectLega("l1")).rejects.toMatchObject({
      status: 507, message: expect.stringMatching(/modifiche della lega aperta non sono salvate/i),
    });
    expect(store().tappe).toBe(tappeInMemoria);
    expect(store().tappe[0].nome).toBe("Finale");
    expect(store().syncError).toMatch(/spazio esaurito/i);
  });

  it("l'errore dice di esportare o liberare spazio prima di aprire o creare un'altra lega", async () => {
    versioneVecchia();
    modificaNonSalvata();
    const errore = await store().selectLega("l1").then(() => new Error("doveva fallire"), (e: Error) => e);
    expect(errore.message).toMatch(/^Spazio esaurito nel browser: /);
    expect(errore.message).toContain("Esporta JSON");
    expect(errore.message).toMatch(/libera spazio/i);
    expect(errore.message).toMatch(/aprirne o crearne un'altra/);
  });

  it("«Apri» dopo aver liberato spazio: la lega aperta si salva, la riapertura mostra le modifiche e l'avviso sparisce", async () => {
    versioneVecchia();
    const pieno = modificaNonSalvata();
    pieno.mockRestore(); // l'utente libera spazio
    await store().selectLega("l1");
    expect(nomeSalvato()).toBe("Finale");
    expect(store().tappe[0].nome).toBe("Finale");
    expect(store().syncError).toBeNull();
  });

  it.each([
    ["creare", () => store().createLega("Nuova")],
    ["importare", () => store().importLega("Importata", [tappa()])],
  ])("%s con lo spazio per la lega nuova ma non per salvare quella aperta: errore, nessuna lega nuova, modifiche e avviso intatti", async (_caso, azione) => {
    versioneVecchia();
    browserPienoPerLaLega("l1"); // la lega nuova è piccola e entrerebbe; quella aperta no
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toMatch(/spazio esaurito/i);
    await expect(azione()).rejects.toMatchObject({ status: 507, message: expect.stringMatching(/modifiche della lega aperta non sono salvate/i) });
    expect(store().legaId).toBe("l1");
    expect(store().leghe!.map((m) => m.id)).toEqual(["l1"]);
    expect(store().tappe[0].nome).toBe("Finale");
    expect(store().syncError).toMatch(/spazio esaurito/i);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("hoop3x3_lega_"))).toEqual(["hoop3x3_lega_l1"]); // niente lega nuova nel browser
  });

  it.each([
    ["creare", () => store().createLega("Nuova")],
    ["importare", () => store().importLega("Importata", [tappa()])],
  ])("%s dopo aver liberato spazio: la lega aperta si salva prima, poi si procede", async (_caso, azione) => {
    versioneVecchia();
    const pieno = modificaNonSalvata();
    pieno.mockRestore();
    await azione();
    expect(nomeSalvato()).toBe("Finale"); // la lega di prima è nel browser con le sue modifiche
    expect(store().legaId).not.toBe("l1");
    expect(store().syncError).toBeNull();
  });

  it("chiudere l'avviso con la X chiude il testo, non la protezione: «Apri» con lo spazio ancora pieno dà errore", async () => {
    versioneVecchia();
    modificaNonSalvata();
    store().clearSyncError();                                // la X della barra
    expect(store().syncError).toBeNull();
    expect(store().spazioEsaurito).toBe(true);
    await expect(store().selectLega("l1")).rejects.toMatchObject({ status: 507 });
    expect(store().tappe[0].nome).toBe("Finale");            // la versione vecchia del browser non l'ha sostituita
  });

  it("dopo la X, liberato lo spazio, «Apri» salva prima la lega aperta", async () => {
    versioneVecchia();
    const pieno = modificaNonSalvata();
    store().clearSyncError();
    pieno.mockRestore();
    await store().selectLega("l1");
    expect(nomeSalvato()).toBe("Finale");
    expect(store().spazioEsaurito).toBe(false);
  });

  it("senza modifiche non salvate (nessun avviso) aprire un'altra lega non scrive né chiede niente", async () => {
    versioneVecchia();
    localStorage.setItem("hoop3x3_lega_l2", JSON.stringify({ nome: "Inverno", tappe: [] }));
    useAppStore.setState({ leghe: [...store().leghe!, { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 }] });
    await store().selectLega("l2");
    expect(store().legaId).toBe("l2");
    expect(nomeSalvato()).toBe("Tappa"); // la lega di prima non è stata riscritta
  });
});

describe("ospite: l'avviso «spazio esaurito» sparisce quando le scritture tornano a riuscire (FS-9)", () => {
  it("eliminando la lega aperta l'avviso sparisce: non c'è più niente da salvare", async () => {
    const pieno = browserPieno();
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toMatch(/spazio esaurito/i);
    pieno.mockRestore();
    await store().deleteLega("l1");
    expect(store().legaId).toBeNull();
    expect(store().syncError).toBeNull();
  });

  it("dopo aver liberato spazio, il salvataggio successivo toglie l'avviso", () => {
    const pieno = browserPieno();
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toMatch(/spazio esaurito/i);
    pieno.mockRestore(); // si è liberato spazio
    store().updateTappa("t1", { nome: "Finale 2" });
    expect(store().syncError).toBeNull();
    expect(JSON.parse(localStorage.getItem("hoop3x3_lega_l1")!).tappe[0].nome).toBe("Finale 2");
  });

  it("finché una scrittura dell'azione fallisce l'avviso resta, anche se un'altra (l'indice, più piccola) riesce", () => {
    browserPienoPerLeLeghe();
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toMatch(/spazio esaurito/i);
    store().updateTappa("t1", { nome: "Finale 2" });
    expect(store().syncError).toMatch(/spazio esaurito/i);
  });

  it("eliminare un'altra lega (entra solo l'indice) non toglie l'avviso: la lega aperta ha ancora modifiche solo in memoria", async () => {
    localStorage.setItem("hoop3x3_lega_l2", JSON.stringify({ nome: "Inverno", tappe: [] }));
    useAppStore.setState({ leghe: [...store().leghe!, { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 }] });
    const pieno = browserPieno();
    store().updateTappa("t1", { nome: "Finale" }); // non si salva
    expect(store().syncError).toMatch(/spazio esaurito/i);
    pieno.mockRestore(); // l'utente segue il consiglio e libera spazio eliminando l'altra lega
    await store().deleteLega("l2");
    expect(localStorage.getItem("hoop3x3_lega_l2")).toBeNull();
    expect(JSON.parse(localStorage.getItem("hoop3x3_leghe_index")!).map((m: { id: string }) => m.id)).toEqual(["l1"]); // l'indice è entrato
    expect(store().syncError).toMatch(/spazio esaurito/i); // ma la lega aperta non è stata salvata: l'avviso dice ancora il vero
    // Il primo salvataggio che scrive la lega aperta riesce: ora le modifiche sono davvero nel browser e l'avviso sparisce
    store().updateTappa("t1", { nome: "Finale 2" });
    expect(store().syncError).toBeNull();
    expect(JSON.parse(localStorage.getItem("hoop3x3_lega_l1")!).tappe[0].nome).toBe("Finale 2");
  });

  it("la protezione (spazioEsaurito) si abbassa con una scrittura riuscita della lega aperta, non con quella del solo indice", async () => {
    localStorage.setItem("hoop3x3_lega_l2", JSON.stringify({ nome: "Inverno", tappe: [] }));
    useAppStore.setState({ leghe: [...store().leghe!, { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 }] });
    const pieno = browserPieno();
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().spazioEsaurito).toBe(true);
    pieno.mockRestore();
    await store().deleteLega("l2");                          // entra solo l'indice
    expect(store().spazioEsaurito).toBe(true);
    store().updateTappa("t1", { nome: "Finale 2" });         // entra la lega aperta
    expect(store().spazioEsaurito).toBe(false);
  });

  it("la protezione si abbassa anche eliminando la lega aperta, e uscendo", async () => {
    const pieno = browserPieno();
    store().updateTappa("t1", { nome: "Finale" });
    pieno.mockRestore();
    await store().deleteLega("l1");
    expect(store().spazioEsaurito).toBe(false);
    useAppStore.setState({ legaId: "l1", tappe: [tappa()], leghe: [{ id: "l1", nome: "Estate", ts: 1, nTappe: 1 }] });
    browserPieno();
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().spazioEsaurito).toBe(true);
    store().reset();
    expect(store().spazioEsaurito).toBe(false);
  });

  it("ricordare la lega aperta è una comodità: se il browser rifiuta solo quella chiave, la protezione non si alza", async () => {
    localStorage.setItem("hoop3x3_lega_l1", JSON.stringify({ nome: "Estate", tappe: [tappa()] }));
    localStorage.setItem("hoop3x3_lega_l2", JSON.stringify({ nome: "Inverno", tappe: [] }));
    useAppStore.setState({ leghe: [...store().leghe!, { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 }] });
    const scrivi = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, chiave: string, valore: string) {
      if (chiave === CHIAVE_OSPITE) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      scrivi.call(this, chiave, valore);
    });
    await store().selectLega("l2");
    expect(store().legaId).toBe("l2");
    expect(store().spazioEsaurito).toBe(false);             // la lega aperta non ha modifiche solo in memoria
    expect(store().syncError).toBeNull();
  });

  it("un altro avviso non si toglie: sparisce solo quello dello spazio", () => {
    useAppStore.setState({ syncError: "La lega «Estate» ha una tappa non valida." });
    store().updateTappa("t1", { nome: "Finale" });
    expect(store().syncError).toBe("La lega «Estate» ha una tappa non valida.");
  });
});

describe("registrato: ricordare la lega aperta non può far fallire l'azione", () => {
  beforeEach(() => {
    useAppStore.setState({ user: registrato });
  });

  it("creare, aprire o importare una lega con il browser pieno funziona, e nessun avviso su dati che sono sul server", async () => {
    vi.mocked(legheApi.create).mockImplementation(async (nome) => ({ id: "l9", nome, ts: 1, nTappe: 0 }));
    vi.mocked(legheApi.get).mockResolvedValue({ id: "l1", nome: "Estate", tappe: [] });
    browserPieno();
    await expect(store().createLega("Nuova")).resolves.toBe("l9");
    await expect(store().selectLega("l1")).resolves.toBeUndefined();
    await expect(store().importLega("Importata", [])).resolves.toBeUndefined();
    expect(store().syncError).toBeNull();
  });
});

describe("la lega aperta per ultima: una chiave per l'ospite e una per il registrato (FS-9)", () => {
  it("il registrato la scrive nella sua chiave, l'ospite in quella storica", async () => {
    vi.mocked(legheApi.create).mockImplementation(async (nome) => ({ id: "l9", nome, ts: 1, nTappe: 0 }));
    useAppStore.setState({ user: registrato });
    await store().createLega("Del server");
    expect(localStorage.getItem(CHIAVE_REGISTRATO)).toBe("l9");
    expect(localStorage.getItem(CHIAVE_OSPITE)).toBeNull();
    useAppStore.setState({ user: ospite });
    const id = await store().createLega("Locale");
    expect(localStorage.getItem(CHIAVE_OSPITE)).toBe(id);
    expect(localStorage.getItem(CHIAVE_REGISTRATO)).toBe("l9");
  });

  it("un registrato che ricarica non cancella la lega aperta dell'ospite, che non è sul server", async () => {
    localStorage.setItem(CHIAVE_OSPITE, "locale-1");
    vi.mocked(legheApi.list).mockResolvedValue([]);
    useAppStore.setState({ user: registrato });
    await store().rehydrate();
    expect(localStorage.getItem(CHIAVE_OSPITE)).toBe("locale-1");
  });

  it("un ospite che ricarica non cancella la lega aperta del registrato, che nel browser non ha dati", async () => {
    localStorage.setItem(CHIAVE_REGISTRATO, "server-1");
    useAppStore.setState({ user: ospite });
    await store().rehydrate();
    expect(localStorage.getItem(CHIAVE_REGISTRATO)).toBe("server-1");
  });

  it("un registrato con la sola chiave storica (scritta prima delle due chiavi) ritrova la sua lega, e la ricorda nella sua", async () => {
    localStorage.setItem(CHIAVE_OSPITE, "l1"); // la chiave storica, quando era una sola per tutti
    vi.mocked(legheApi.list).mockResolvedValue([{ id: "l1", nome: "Estate", ts: 1, nTappe: 0 }]);
    vi.mocked(legheApi.get).mockResolvedValue({ id: "l1", nome: "Estate", tappe: [] });
    useAppStore.setState({ user: registrato, legaId: null, legaName: "", leghe: [], tappe: [] });
    await store().rehydrate();
    expect(store().legaId).toBe("l1");
    await store().selectLega("l1");
    expect(localStorage.getItem(CHIAVE_REGISTRATO)).toBe("l1");
  });

  it("il registrato ritrova la sua lega, anche se l'ospite ne ha un'altra aperta", async () => {
    localStorage.setItem(CHIAVE_OSPITE, "locale-1");
    localStorage.setItem(CHIAVE_REGISTRATO, "l1");
    vi.mocked(legheApi.list).mockResolvedValue([{ id: "l1", nome: "Estate", ts: 1, nTappe: 0 }]);
    vi.mocked(legheApi.get).mockResolvedValue({ id: "l1", nome: "Estate", tappe: [] });
    useAppStore.setState({ user: registrato, legaId: null, legaName: "", leghe: [], tappe: [] });
    await store().rehydrate();
    expect(store().legaId).toBe("l1");
  });

  it("uscire toglie la lega aperta di chi esce e lascia quella dell'altra modalità", () => {
    localStorage.setItem(CHIAVE_OSPITE, "locale-1");
    localStorage.setItem(CHIAVE_REGISTRATO, "server-1");
    useAppStore.setState({ user: registrato });
    store().reset();
    expect(localStorage.getItem(CHIAVE_REGISTRATO)).toBeNull();
    expect(localStorage.getItem(CHIAVE_OSPITE)).toBe("locale-1");
  });
});

describe("ospite con l'app aperta in due schede: nessuna scheda cancella ciò che ha scritto l'altra", () => {
  const INDICE = "hoop3x3_leghe_index";
  const LEGA_L1 = "hoop3x3_lega_l1";
  /** Gli id delle leghe dell'indice nel browser */
  const indiceNelBrowser = () => (JSON.parse(localStorage.getItem(INDICE) ?? "[]") as { id: string }[]).map((m) => m.id);
  /** L'altra scheda scrive questa chiave: qui arriva l'evento storage (il browser lo manda solo alle altre schede) */
  function scriveLAltraScheda(chiave: string, valore: string | null) {
    if (valore === null) localStorage.removeItem(chiave);
    else localStorage.setItem(chiave, valore);
    window.dispatchEvent(new StorageEvent("storage", { key: chiave, newValue: valore }));
  }
  /** L'indice con «Estate» (la lega aperta qui) e «Inverno», creata nell'altra scheda */
  const conInverno = JSON.stringify([{ id: "l1", nome: "Estate", ts: 1, nTappe: 1 }, { id: "l2", nome: "Inverno", ts: 2, nTappe: 0 }]);

  beforeEach(() => {
    localStorage.setItem(INDICE, JSON.stringify(store().leghe));
    localStorage.setItem(LEGA_L1, JSON.stringify({ nome: "Estate", tappe: [tappa()] }));
  });

  it("una lega creata nell'altra scheda compare nell'elenco, e una modifica qui non la toglie dall'indice", () => {
    scriveLAltraScheda(INDICE, conInverno);
    expect(store().leghe!.map((m) => m.nome)).toEqual(["Estate", "Inverno"]);
    store().updateTappa("t1", { nome: "Finale" });
    expect(indiceNelBrowser()).toEqual(["l1", "l2"]);
  });

  it("anche senza l'evento, l'indice si rilegge prima di riscriverlo", () => {
    localStorage.setItem(INDICE, conInverno); // l'altra scheda ha scritto, l'evento non è ancora arrivato
    store().updateTappa("t1", { nome: "Finale" });
    expect(indiceNelBrowser()).toEqual(["l1", "l2"]);
    store().setLegaName("Estate 2026");
    expect(indiceNelBrowser()).toEqual(["l1", "l2"]);
  });

  it("creare o eliminare una lega qui tiene quella creata nell'altra scheda", async () => {
    localStorage.setItem(INDICE, conInverno);
    await store().createLega("Primavera");
    expect(indiceNelBrowser()).toHaveLength(3);
    expect(indiceNelBrowser().slice(0, 2)).toEqual(["l1", "l2"]);
    await store().deleteLega("l1");
    expect(indiceNelBrowser()).toContain("l2");
    expect(indiceNelBrowser()).not.toContain("l1");
  });

  it("la lega aperta salvata nell'altra scheda si rilegge: la modifica successiva qui parte dalla sua versione", () => {
    scriveLAltraScheda(LEGA_L1, JSON.stringify({ nome: "Estate", tappe: [{ ...tappa(), luogo: "Roma" }] }));
    expect(store().tappe[0].luogo).toBe("Roma");
    store().updateTappa("t1", { nome: "Finale" });
    const salvata = JSON.parse(localStorage.getItem(LEGA_L1) ?? "null");
    expect(salvata.tappe[0]).toMatchObject({ nome: "Finale", luogo: "Roma" });
  });

  it("la lega aperta eliminata nell'altra scheda si chiude anche qui, con l'avviso, e non si riscrive", () => {
    scriveLAltraScheda(LEGA_L1, null);
    expect(store()).toMatchObject({ legaId: null, tappe: [], syncError: "La lega aperta è stata eliminata in un'altra scheda di questo browser." });
    expect(localStorage.getItem(LEGA_L1)).toBeNull();
  });

  it("con modifiche rimaste solo in memoria qui (spazio esaurito), la versione dell'altra scheda vale e l'avviso lo dice", () => {
    useAppStore.setState({ spazioEsaurito: true });
    scriveLAltraScheda(LEGA_L1, JSON.stringify({ nome: "Estate", tappe: [{ ...tappa(), luogo: "Roma" }] }));
    expect(store().syncError).toMatch(/^La lega è stata salvata da un'altra scheda/);
    expect(store().spazioEsaurito).toBe(false);
  });

  it("un registrato non guarda le chiavi dell'ospite", () => {
    useAppStore.setState({ user: registrato });
    const prima = store().tappe;
    scriveLAltraScheda(LEGA_L1, null);
    scriveLAltraScheda(INDICE, conInverno);
    expect(store().tappe).toBe(prima);
    expect(store().legaId).toBe("l1");
  });
});
