// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LegaPage } from "../../src/pages/LegaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { ApiError } from "../../src/services/api";
import { creaTappa } from "../../src/domain/tappaOps";
import { testoFileLega } from "../../src/utils/legaFile";
import { isUuid, uid } from "../../src/utils/uid";
import {
  FILE_NON_SUPPORTATO, FOTO_RISERVATA, FOTO_TROPPO_GRANDE, JSON_TROPPO_GRANDE, LETTURA_FALLITA, LETTURA_IN_CORSO, NESSUN_DUBBIO,
  SCELTA_FILE, TROPPE_FOTO,
} from "../../src/utils/testi";
import type { BozzaFoglio, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: pagina, store e lettura del file sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

// La lettura delle foto (canvas e server) è finta: la pagina riceve le bozze. `imposta` cambia lo `stato` dell'hook come farebbe
// quello vero durante la lettura
const fotoFinte = vi.hoisted(() => ({ leggiFoto: vi.fn(), imposta: (_stato: string | null) => {} }));
vi.mock("../../src/hooks/useImportaFoto", async () => {
  const { useState } = await import("react");
  return {
    useImportaFoto: () => {
      const [stato, setStato] = useState<string | null>(null);
      fotoFinte.imposta = setStato;
      return { leggiFoto: fotoFinte.leggiFoto, stato };
    },
  };
});

const api = vi.mocked(legheApi);
const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

/** Una tappa valida, come la crea l'app: 4 squadre e 2 gironi */
function nuovaTappa(nome: string): Tappa {
  const esito = creaTappa({
    nome, luogo: "Roma", data: "2026-06-14", nGironi: 2,
    squadre: Array.from({ length: 4 }, (_, i) => ({ id: uid(), nome: `Squadra ${i + 1}`, giocatori: [], rank: "" })),
  });
  if (!esito.ok) throw new Error(esito.errore);
  return esito.tappa;
}

/** La tappa della lega aperta prima dell'import: deve restare dov'è se l'import non riesce */
let originale: Tappa;

/** Apre la pagina della lega "l1", che ha una tappa */
function apriLega(user: User) {
  originale = nuovaTappa("Tappa originale");
  useAppStore.setState({
    user, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], legaName: "Lega", tappe: [originale],
  });
  render(
    <MemoryRouter initialEntries={["/lega"]}>
      <Routes>
        <Route path="/lega" element={<LegaPage />} />
        <Route path="/leghe" element={<p>Elenco delle leghe</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fileDi = (contenuto: string, nome = "lega.json") => new File([contenuto], nome, { type: "application/json" });

/** Un file di lega valido, con una tappa che ha un id fisso: serve a vedere che l'import ne dà uno nuovo */
const fileValido = () => fileDi(testoFileLega("Lega importata", [{ ...nuovaTappa("Tappa del file"), id: "id-del-file" }]));

/** Una tappa senza squadre: il caso che prima faceva uscire la pagina bianca */
const fileSenzaSquadre = () => fileDi(JSON.stringify({ nome: "Rotta", tappe: [{ ...nuovaTappa("Senza squadre"), squadre: undefined }] }));

/** Sceglie un file nel campo nascosto di «Importa file» */
function scegli(file: File) {
  const campo = document.querySelector<HTMLInputElement>("input[type=\"file\"]")!;
  fireEvent.change(campo, { target: { files: [file] } });
}

/** Sceglie più file insieme nel campo di «Importa file» */
function scegliTutti(files: File[]) {
  const campo = document.querySelector<HTMLInputElement>("input[type=\"file\"]")!;
  fireEvent.change(campo, { target: { files } });
}

/** Il messaggio di errore della pagina, quando compare */
const messaggio = async () => (await screen.findByRole("alert")).textContent;

/** window.alert finto: la pagina non deve più usarlo (i messaggi stanno nella pagina) */
let alertFinto: MockInstance<typeof window.alert>;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  alertFinto = vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  store().reset();
  localStorage.clear();
});

describe("LegaPage: «Importa JSON» da ospite", () => {
  it("una lega valida viene importata e aperta, con le tappe del file e id nuovi", async () => {
    apriLega(ospite);
    scegli(fileValido());
    await screen.findByText("Tappa del file");
    expect(store().legaName).toBe("Lega importata");
    expect(store().tappe).toHaveLength(1);
    expect(isUuid(store().tappe[0].id)).toBe(true);
    expect(store().tappe[0].id).not.toBe("id-del-file");
    // nel browser c'è la lega completa: alla ricarica si riapre
    const salvata = JSON.parse(localStorage.getItem(`hoop3x3_lega_${store().legaId}`)!);
    expect(salvata.tappe[0].nome).toBe("Tappa del file");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("una tappa vecchia, con più gironi di metà delle squadre, si ripristina com'era", async () => {
    apriLega(ospite);
    // 4 squadre e 3 gironi: la creazione ne ammette al massimo 2, ma l'import è un ripristino e accetta ciò che accetta il server
    scegli(fileDi(testoFileLega("Lega vecchia", [{ ...nuovaTappa("Tappa vecchia"), nGironi: 3 }])));
    await screen.findByText("Tappa vecchia");
    expect(store().legaName).toBe("Lega vecchia");
    expect(store().tappe[0].nGironi).toBe(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un file che non è JSON: il motivo compare nella pagina e la lega resta com'era", async () => {
    apriLega(ospite);
    scegli(fileDi("{ non json"));
    expect(await messaggio()).toBe("Import non riuscito: il file non è un JSON valido");
    expect(store().legaId).toBe("l1");
    expect(store().tappe).toEqual([originale]);
    expect(alertFinto).not.toHaveBeenCalled();
  });

  it("un file senza tappe: il messaggio dice che manca «tappe»", async () => {
    apriLega(ospite);
    scegli(fileDi(JSON.stringify({ nome: "Senza tappe" })));
    expect(await messaggio()).toBe("Import non riuscito: manca il campo «tappe»");
    expect(store().legaId).toBe("l1");
    expect(alertFinto).not.toHaveBeenCalled();
  });

  it("una tappa senza squadre è rifiutata: nel browser non entra niente e la pagina resta usabile", async () => {
    apriLega(ospite);
    scegli(fileSenzaSquadre());
    expect(await messaggio()).toBe("Import non riuscito: tappe[0]: manca il campo «squadre»");
    expect(alertFinto).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0); // né la lega né l'indice delle leghe sono stati scritti
    expect(store().legaId).toBe("l1");
    // nessuna schermata bianca: la pagina è ancora lì, con la sua tappa
    expect(screen.getByText("Le tappe del circuito")).toBeTruthy();
    expect(screen.getByText("Tappa originale")).toBeTruthy();
  });

  it("se il file non si può leggere compare un messaggio", async () => {
    // Un FileReader che fallisce, come per un file spostato o senza permessi dopo averlo scelto
    vi.stubGlobal("FileReader", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() { queueMicrotask(() => this.onerror?.()); }
    });
    apriLega(ospite);
    scegli(fileValido());
    expect(await messaggio()).toBe("Import non riuscito: impossibile leggere il file");
    expect(store().legaId).toBe("l1");
    expect(alertFinto).not.toHaveBeenCalled();
  });

  it("il messaggio resta finché non si sceglie un altro file, e un import riuscito lo toglie", async () => {
    apriLega(ospite);
    scegli(fileDi("{ non json"));
    await screen.findByRole("alert");
    scegli(fileValido());
    await screen.findByText("Tappa del file");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("se il browser non ha spazio per salvare la lega compare un messaggio e la lega resta com'era", async () => {
    apriLega(ospite);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota esaurita", "QuotaExceededError");
    });
    scegli(fileValido());
    expect(await messaggio()).toBe(
      "Import non riuscito: Spazio esaurito nel browser: la lega non si può salvare. Elimina le leghe che non usi per liberare spazio.",
    );
    expect(store().legaId).toBe("l1");
    expect(alertFinto).not.toHaveBeenCalled();
  });
});

describe("LegaPage: «Importa JSON» da utente registrato", () => {
  it("se il server rifiuta il file, la pagina riporta il testo del server", async () => {
    api.create.mockRejectedValue(new ApiError(400, "tappe[0].nome: non deve essere vuoto"));
    apriLega(registrato);
    scegli(fileValido());
    expect(await messaggio()).toBe("Import non riuscito: tappe[0].nome: non deve essere vuoto");
    expect(store().legaId).toBe("l1");
    expect(store().tappe).toEqual([originale]);
    expect(alertFinto).not.toHaveBeenCalled();
  });

  it("un file incompleto non arriva al server", async () => {
    apriLega(registrato);
    scegli(fileSenzaSquadre());
    await screen.findByRole("alert");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("export seguito da import della stessa lega, con l'originale ancora sul server: nessun 409 e id nuovi", async () => {
    apriLega(registrato);
    // Server finto che, come quello vero, rifiuta con 409 una tappa il cui id esiste già
    const sulServer = new Set([originale.id]);
    api.create.mockImplementation(async (nome, tappe = []) => {
      const doppia = tappe.find((t) => sulServer.has(t.id));
      if (doppia) throw new ApiError(409, `Esiste già una tappa con id ${doppia.id}`);
      tappe.forEach((t) => sulServer.add(t.id));
      return { id: "lega-nuova", nome, ts: 1, nTappe: tappe.length };
    });
    // «Esporta JSON» in jsdom: il file scaricato è il Blob passato a createObjectURL
    const esportati: Blob[] = [];
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: (b: Blob) => { esportati.push(b); return "blob:prova"; } });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      fireEvent.click(screen.getByRole("button", { name: /Esporta JSON/ }));
      expect(esportati).toHaveLength(1);
      scegli(new File([esportati[0]], "Lega.json", { type: "application/json" }));
      await waitFor(() => expect(store().legaId).toBe("lega-nuova"));
    } finally {
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
    expect(store().tappe).toHaveLength(1);
    expect(store().tappe[0].nome).toBe("Tappa originale");
    expect(store().tappe[0].id).not.toBe(originale.id);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* ── «Importa file»: il JSON come prima, oppure le foto dei fogli ── */

/** Una foto JPEG (bastano i primi byte: la riduzione è finta), con la dimensione dichiarata se serve */
function fotoDi(nome: string, byte?: number) {
  const f = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], nome, { type: "image/jpeg" });
  if (byte !== undefined) Object.defineProperty(f, "size", { value: byte });
  return f;
}

const MB = 1024 * 1024;

/** La bozza di un foglio: 4 squadre in 2 gironi e un risultato */
const bozzaFoglio = (nome: string, dubbi: string[] = []): BozzaFoglio => ({
  nome, luogo: "Roma", data: "2026-06-14",
  squadre: ["Alfa", "Beta", "Gamma", "Delta"].map((n) => ({ nome: n, giocatori: [`${n} Uno`, `${n} Due`, `${n} Tre`] })),
  gironi: [["Alfa", "Beta"], ["Gamma", "Delta"]],
  partite: [{ a: "Alfa", b: "Beta", puntiA: 21, puntiB: 15 }],
  dubbi,
});

/** Il server finto crea la lega importata */
const serverCreaLega = () =>
  api.create.mockImplementation(async (nome, tappe = []) => ({ id: "lega-foto", nome, ts: 1, nTappe: tappe.length }));

describe("LegaPage: «Importa file»", () => {
  it("il pulsante si chiama «Importa file» e l'unico campo file accetta JSON e foto, anche più di una", () => {
    apriLega(ospite);
    expect(screen.getByRole("button", { name: /Importa file/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Importa JSON/ })).toBeNull();
    const campi = document.querySelectorAll<HTMLInputElement>("input[type=\"file\"]");
    expect(campi).toHaveLength(1);
    expect(campi[0].accept).toBe(".json,application/json,image/jpeg,image/png,image/webp");
    expect(campi[0].multiple).toBe(true);
  });

  it("un file che non è né JSON né foto (un PDF rinominato .jpg): il motivo lo nomina e niente parte", async () => {
    apriLega(registrato);
    scegli(fileDi("%PDF-1.4 un documento", "foglio.jpg"));
    expect(await messaggio()).toBe(`Import non riuscito: ${FILE_NON_SUPPORTATO("foglio.jpg")}`);
    expect(fotoFinte.leggiFoto).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("un .json che contiene HTML non si importa", async () => {
    apriLega(ospite);
    scegli(fileDi("<html><script>alert(1)</script></html>", "lega.json"));
    expect(await messaggio()).toBe(`Import non riuscito: ${FILE_NON_SUPPORTATO("lega.json")}`);
    expect(store().legaId).toBe("l1");
  });

  it("JSON e foto insieme, più di 10 foto, una foto oltre 20 MB, un JSON oltre 5 MB: il motivo, e nessuna lettura", async () => {
    apriLega(registrato);
    scegliTutti([fileValido(), fotoDi("a.jpg")]);
    expect(await messaggio()).toBe(`Import non riuscito: ${SCELTA_FILE}`);
    scegliTutti(Array.from({ length: 11 }, (_, i) => fotoDi(`f${i}.jpg`)));
    await waitFor(async () => expect(await messaggio()).toBe(`Import non riuscito: ${TROPPE_FOTO}`));
    scegliTutti([fotoDi("piccola.jpg"), fotoDi("grande.jpg", 21 * MB)]);
    await waitFor(async () => expect(await messaggio()).toBe(`Import non riuscito: ${FOTO_TROPPO_GRANDE("grande.jpg")}`));
    const grande = fileValido();
    Object.defineProperty(grande, "size", { value: 6 * MB });
    scegli(grande);
    await waitFor(async () => expect(await messaggio()).toBe(`Import non riuscito: ${JSON_TROPPO_GRANDE}`));
    expect(fotoFinte.leggiFoto).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("l'ospite con una foto: è riservata agli utenti registrati, e non parte nessuna lettura", async () => {
    apriLega(ospite);
    scegli(fotoDi("foglio.jpg"));
    expect(await messaggio()).toBe(`Import non riuscito: ${FOTO_RISERVATA}`);
    expect(fotoFinte.leggiFoto).not.toHaveBeenCalled();
    expect(store().legaId).toBe("l1");
  });

  it("due foto lette: lega nuova con una tappa per foglio e la finestra con i dubbi di ciascuna; «Non ora» la chiude", async () => {
    fotoFinte.leggiFoto.mockResolvedValue([bozzaFoglio("Sabato", ["Il 15 potrebbe essere un 16"]), bozzaFoglio("Domenica")]);
    serverCreaLega();
    apriLega(registrato);
    const foto = [fotoDi("sabato.jpg"), fotoDi("domenica.jpg")];
    scegliTutti(foto);
    const finestra = await screen.findByRole("alertdialog", { name: "Tappe importate dai fogli" });
    expect(fotoFinte.leggiFoto).toHaveBeenCalledWith(foto);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(store().legaId).toBe("lega-foto");
    expect(store().legaName).toBe("Sabato");
    expect(store().tappe.map((t) => t.nome)).toEqual(["Sabato", "Domenica"]);
    expect(store().tappe[0].partite.filter((m) => m.done)).toHaveLength(1);
    expect(finestra.textContent).toContain("sabato.jpg: Il 15 potrebbe essere un 16");
    expect(finestra.textContent).toContain(NESSUN_DUBBIO);
    expect(finestra.textContent).toContain("Vuoi passarle al Coach AI per le correzioni?");
    expect(screen.getByRole("button", { name: "Apri il Coach" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Non ora" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("Le tappe del circuito")).toBeTruthy();
    expect(screen.getAllByText("Domenica").length).toBeGreaterThan(0);
  });

  it("una foto letta: il titolo è al singolare", async () => {
    fotoFinte.leggiFoto.mockResolvedValue([bozzaFoglio("Sabato")]);
    serverCreaLega();
    apriLega(registrato);
    scegli(fotoDi("sabato.jpg"));
    const finestra = await screen.findByRole("alertdialog", { name: "Tappa importata dal foglio" });
    expect(finestra.textContent).toContain("Vuoi passarla al Coach AI per le correzioni?");
  });

  it("una lettura fallita: il messaggio nomina la foto e il motivo, e nessuna lega nasce a metà", async () => {
    fotoFinte.leggiFoto.mockRejectedValue(new Error(LETTURA_FALLITA("b.jpg", "Il lettore dei fogli non è disponibile in questo momento")));
    apriLega(registrato);
    scegliTutti([fotoDi("a.jpg"), fotoDi("b.jpg")]);
    expect(await messaggio()).toBe(
      "Import non riuscito: Foto «b.jpg»: Il lettore dei fogli non è disponibile in questo momento",
    );
    expect(api.create).not.toHaveBeenCalled();
    expect(store().legaId).toBe("l1");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("una bozza con meno di 2 squadre: la foto non si importa", async () => {
    fotoFinte.leggiFoto.mockResolvedValue([{ ...bozzaFoglio("Vuota"), squadre: [], gironi: null, partite: [] }]);
    apriLega(registrato);
    scegli(fotoDi("vuota.jpg"));
    expect(await messaggio()).toBe("Import non riuscito: Foto «vuota.jpg»: Il foglio ha meno di 2 squadre leggibili.");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("durante la lettura lo stato si annuncia (aria-live) e il pulsante è disattivato", async () => {
    let risolvi: (b: BozzaFoglio[]) => void = () => {};
    fotoFinte.leggiFoto.mockImplementation(() => {
      fotoFinte.imposta(LETTURA_IN_CORSO(1, 1));
      return new Promise((r) => { risolvi = r; });
    });
    serverCreaLega();
    apriLega(registrato);
    scegli(fotoDi("sabato.jpg"));
    const stato = await screen.findByText(LETTURA_IN_CORSO(1, 1));
    expect(stato.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("button", { name: /Importa file/ }).hasAttribute("disabled")).toBe(true);
    fotoFinte.imposta(null);
    risolvi([bozzaFoglio("Sabato")]);
    await screen.findByRole("alertdialog");
    expect(screen.getByRole("button", { name: /Importa file/ }).hasAttribute("disabled")).toBe(false);
  });
});
