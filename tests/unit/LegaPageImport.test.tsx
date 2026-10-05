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
import type { Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: pagina, store e lettura del file sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

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

/** Sceglie un file nel campo nascosto di «Importa JSON» */
function scegli(file: File) {
  const campo = document.querySelector<HTMLInputElement>("input[type=\"file\"]")!;
  fireEvent.change(campo, { target: { files: [file] } });
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
    expect(await messaggio()).toBe("Import non riuscito: errore imprevisto");
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
