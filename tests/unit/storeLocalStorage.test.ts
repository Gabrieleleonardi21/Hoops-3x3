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
    useAppStore.setState({ leghe: [...store().leghe, { id: "l2", nome: "Inverno", ts: 1, nTappe: 0 }] });
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
