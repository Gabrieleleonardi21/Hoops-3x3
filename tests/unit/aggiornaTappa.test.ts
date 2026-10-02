// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAppStore } from "../../src/stores/useAppStore";
import { useTappa } from "../../src/hooks/useTappa";
import type { MatchDraft } from "../../src/hooks/useTappa";
import { legheApi } from "../../src/services/legheApi";
import { archivioApi } from "../../src/services/archivioApi";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Partita, RegSquadra, SquadraTappa, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: store, coda dei salvataggi e hook sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

// Anche l'archivio è solo rete: si controlla che cosa viene pubblicato
vi.mock("../../src/services/archivioApi", () => ({
  archivioApi: { list: vi.fn(), get: vi.fn(), pubblica: vi.fn(), rimuovi: vi.fn() },
}));

const api = vi.mocked(legheApi);
const archivio = vi.mocked(archivioApi);
const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const ospite: User = { name: "Ospite", guest: true };

const squadra = (id: string, nome: string): SquadraTappa => ({ id, nome, giocatori: [], rank: "" });
/** Tappa con due squadre ancora con il nome predefinito, come subito dopo la creazione */
const tappa = (): Tappa => ({
  id: "t1", nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [squadra("s1", "Squadra 1"), squadra("s2", "Squadra 2")], gironi: null, partite: [], video: [],
});
/** Le squadre della tappa com'è adesso nello store */
const squadre = () => store().tappe[0].squadre;
/** Le partite della tappa com'è adesso nello store */
const partite = () => store().tappe[0].partite;
/** Partita già giocata (21-15) tra le prime due squadre */
const giocata = (id: string): Partita => ({ id, g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true });
/** Partita ancora da giocare tra le prime due squadre */
const daGiocare = (id: string): Partita => ({ ...giocata(id), sa: 0, sb: 0, done: false });
/** La tappa già sorteggiata (un girone con le prime due squadre) con queste partite */
const sorteggiata = (partite: Partita[], base: Tappa = tappa()): Tappa => ({ ...base, gironi: [["s1", "s2"]], partite });
/** La tappa con tre giocatori con il nome in ogni squadra (roster completi) */
const conRoster = (t: Tappa): Tappa => ({
  ...t,
  squadre: t.squadre.map((s) => ({
    ...s, giocatori: [1, 2, 3].map((n) => ({ id: `${s.id}g${n}`, nome: `Giocatore ${n}` })),
  })),
});
/** Bozza del punteggio come la scrive l'utente: 21 per la prima squadra (7+7+7), 15 per la seconda (5+5+5) */
const bozza21a15: MatchDraft = {
  sa: "21", sb: "15",
  pa: { s1g1: { pt: "7" }, s1g2: { pt: "7" }, s1g3: { pt: "7" } },
  pb: { s2g1: { pt: "5" }, s2g2: { pt: "5" }, s2g3: { pt: "5" } },
};

/** La squadra «Alfa» come la restituisce l'anagrafe */
const regAlfa: RegSquadra = {
  id: "r1", nome: "Alfa", citta: "", anno: "", rank: "40", referente: "", roster: [], logo: "/logos/alfa.svg",
  website: "https://alfa.it", instagram: "", note: "", autore: "Anna", ts: 1,
};

/** Promessa controllabile a mano: il test decide quando il "server" risponde */
function differita<T>() {
  let ok!: (v: T) => void;
  const p = new Promise<T>((res) => { ok = res; });
  return { p, ok };
}

/** Esegue un'azione dell'hook dentro act (aggiorna lo stato di React) */
const fai = (azione: () => unknown) => act(() => { azione(); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.putTappa.mockImplementation(async (t) => t);
  archivio.pubblica.mockImplementation(async (t, lega) => ({ tappa: t, lega, autore: "Anna", ts: 1 }));
  useAppStore.setState({
    user: registrato, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [tappa()],
  });
});

afterEach(() => {
  cleanup();           // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();     // svuota la coda, così nessun salvataggio passa al test successivo
  localStorage.clear();
  vi.useRealTimers();
});

describe("updateTappa con una funzione", () => {
  it("la funzione riceve la tappa com'è adesso nello store, comprese le modifiche appena fatte", () => {
    store().updateTappa("t1", { luogo: "Roma" });
    store().updateTappa("t1", (t) => ({ ...t, nome: `${t.nome} · ${t.luogo}` }));
    expect(store().tappe[0]).toMatchObject({ nome: "Tappa · Roma", luogo: "Roma" });
  });

  it("le altre tappe restano come sono", () => {
    const altra = { ...tappa(), id: "t2" };
    useAppStore.setState({ tappe: [tappa(), altra] });
    store().updateTappa("t1", (t) => ({ ...t, nome: "Finale" }));
    expect(store().tappe[1]).toBe(altra);
  });

  it("registrato: la versione calcolata dalla funzione entra nella coda e viene salvata come ogni altra modifica", async () => {
    store().updateTappa("t1", (t) => ({ ...t, nome: "Finale" }));
    expect(store().inSospeso).toBe(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    expect(api.putTappa).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", nome: "Finale" }));
  });

  it("ospite: la versione calcolata dalla funzione finisce in localStorage", () => {
    useAppStore.setState({ user: ospite });
    store().updateTappa("t1", (t) => ({ ...t, nome: "Finale" }));
    const salvata = JSON.parse(localStorage.getItem("hoop3x3_lega_l1") ?? "null");
    expect(salvata.tappe[0].nome).toBe("Finale");
  });
});

describe("useTappa: le modifiche partono dalla tappa com'è adesso, non da quella vista dal componente", () => {
  it("sonda A: mentre una squadra viene collegata all'anagrafe, ciò che si scrive in un'altra resta", async () => {
    const { result } = renderHook(() => useTappa("t1"));
    fai(() => result.current.renameTeam("s1", "Alfa"));
    // L'utente esce dal campo: la pagina tiene l'`h` di questo momento mentre aspetta il server
    const hAllUscita = result.current;
    const server = differita<RegSquadra>();
    const collegamento = server.p.then((reg) => hAllUscita.applyReg("s1", reg));
    // Mentre il server risponde, l'utente scrive «Beta» nella seconda squadra
    fai(() => result.current.renameTeam("s2", "Beta"));
    await act(async () => {
      server.ok(regAlfa);
      await collegamento;
    });
    expect(squadre()).toMatchObject([
      { id: "s1", nome: "Alfa", regId: "r1", rank: "40", website: "https://alfa.it", logo: "/logos/alfa.svg" },
      { id: "s2", nome: "Beta" },
    ]);
  });

  // Negli altri test `h` è la vista del primo render e non si aggiorna mai: ogni operazione fatta con lei di seguito
  // alle altre mostra se parte dalla tappa di adesso (le modifiche si sommano) o dalla copia vecchia (l'ultima vince)

  it("nome, ranking, sito e logo di una squadra, impostati di seguito, si sommano", () => {
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.renameTeam("s1", "Alfa"));
    fai(() => h.setTeamRank("s1", "40"));
    fai(() => h.setTeamWebsite("s1", "https://alfa.it"));
    fai(() => h.setTeamLogo("s1", "/logos/alfa.svg"));
    expect(squadre()[0]).toMatchObject({ nome: "Alfa", rank: "40", website: "https://alfa.it", logo: "/logos/alfa.svg" });
  });

  it("giocatori aggiunti, rinominati e tolti di seguito si sommano", () => {
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.addPlayer("s1"));
    fai(() => h.addPlayer("s1"));
    expect(squadre()[0].giocatori).toHaveLength(2);
    const [primo, secondo] = squadre()[0].giocatori;
    fai(() => h.renamePlayer("s1", primo.id, "Mario"));
    fai(() => h.renamePlayer("s1", secondo.id, "Luca"));
    expect(squadre()[0].giocatori.map((p) => p.nome)).toEqual(["Mario", "Luca"]);
    fai(() => h.removePlayer("s1", primo.id));
    expect(squadre()[0].giocatori.map((p) => p.nome)).toEqual(["Luca"]);
  });

  it("un roster non supera i 4 giocatori", () => {
    const { result } = renderHook(() => useTappa("t1"));
    for (let i = 0; i < 5; i++) fai(() => result.current.addPlayer("s1"));
    expect(squadre()[0].giocatori).toHaveLength(4);
  });

  it("squadre aggiunte di seguito si sommano e prendono numeri diversi", () => {
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.addTeam());
    fai(() => h.addTeam());
    expect(squadre().map((s) => s.nome)).toEqual(["Squadra 1", "Squadra 2", "Squadra 3", "Squadra 4"]);
  });

  it("squadre tolte di seguito si sommano", () => {
    useAppStore.setState({ tappe: [{ ...tappa(), squadre: ["s1", "s2", "s3", "s4"].map((id) => squadra(id, id)) }] });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.removeTeam("s3"));
    fai(() => h.removeTeam("s4"));
    expect(squadre().map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("non si scende sotto le 2 squadre", () => {
    const { result } = renderHook(() => useTappa("t1"));
    fai(() => result.current.removeTeam("s1"));
    expect(squadre()).toHaveLength(2);
  });

  it("non si superano le 64 squadre", () => {
    const sessantaquattro = Array.from({ length: 64 }, (_, i) => squadra(`q${i}`, `Squadra ${i + 1}`));
    useAppStore.setState({ tappe: [{ ...tappa(), squadre: sessantaquattro }] });
    const { result } = renderHook(() => useTappa("t1"));
    fai(() => result.current.addTeam());
    expect(squadre()).toHaveLength(64);
  });

  it("le regole impostate di seguito si sommano", () => {
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.setRule("target", "11"));
    fai(() => h.setRule("durata", "8"));
    expect(store().tappe[0].regole).toMatchObject({ target: 11, durata: 8 });
  });

  it("partite riaperte di seguito si sommano", () => {
    useAppStore.setState({ tappe: [sorteggiata([giocata("m1"), giocata("m2")])] });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.reopenScore("m1"));
    fai(() => h.reopenScore("m2"));
    expect(partite().map((m) => m.done)).toEqual([false, false]);
  });

  it("eventi di gara aggiunti e tolti di seguito si sommano", () => {
    useAppStore.setState({ tappe: [sorteggiata([giocata("m1")])] });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    const fallo = { tipo: "fallo", teamId: "s1", pid: null, min: "3", nota: "" };
    fai(() => h.addEvent("m1", fallo));
    fai(() => h.addEvent("m1", { ...fallo, min: "5" }));
    expect(partite()[0].eventi?.map((e) => e.min)).toEqual(["3", "5"]);
    const primoEvento = partite()[0].eventi![0];
    fai(() => h.removeEvent("m1", primoEvento.id));
    expect(partite()[0].eventi?.map((e) => e.min)).toEqual(["5"]);
  });

  describe("sincronizzazione con l'anagrafe", () => {
    it("allinea le squadre senza cancellare ciò che è stato scritto dopo che la pagina ha letto la tappa", () => {
      useAppStore.setState({ tappe: [{ ...tappa(), squadre: [squadra("s1", "Alfa"), squadra("s2", "Squadra 2")] }] });
      const { result } = renderHook(() => useTappa("t1"));
      const h = result.current;
      fai(() => result.current.renameTeam("s2", "Beta"));
      fai(() => h.syncFromAnagrafe([regAlfa]));
      expect(squadre()).toMatchObject([
        { id: "s1", nome: "Alfa", regId: "r1", rank: "40" },
        { id: "s2", nome: "Beta" },
      ]);
    });

    it("una squadra già collegata segue l'anagrafe anche se il nome è cambiato", () => {
      const vecchia = { ...squadra("s1", "Alfa Roma"), regId: "r1" };
      useAppStore.setState({ tappe: [{ ...tappa(), squadre: [vecchia, squadra("s2", "Squadra 2")] }] });
      const { result } = renderHook(() => useTappa("t1"));
      fai(() => result.current.syncFromAnagrafe([regAlfa]));
      expect(squadre()[0]).toMatchObject({ nome: "Alfa", regId: "r1", rank: "40", logo: "/logos/alfa.svg" });
    });

    it("se le squadre sono già allineate non salva niente: altrimenti partirebbe un salvataggio a ogni apertura della pagina", async () => {
      const collegata = { ...squadra("s1", "Alfa"), regId: "r1", rank: "40", logo: "/logos/alfa.svg", website: "https://alfa.it" };
      useAppStore.setState({ tappe: [{ ...tappa(), squadre: [collegata, squadra("s2", "Squadra 2")] }] });
      const { result } = renderHook(() => useTappa("t1"));
      fai(() => result.current.syncFromAnagrafe([regAlfa]));
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(store().inSospeso).toBe(0);
      expect(api.putTappa).not.toHaveBeenCalled();
    });
  });
});

describe("useTappa: le operazioni di tappaOps si applicano alla tappa di adesso", () => {
  it("il sorteggio comprende le squadre aggiunte dopo che la vista ha letto la tappa", () => {
    useAppStore.setState({ user: ospite });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current; // vista con 2 squadre
    fai(() => result.current.addTeam());
    let errore: string | null = "non eseguito";
    fai(() => { errore = h.sorteggia("casuale"); });
    expect(errore).toBeNull();
    expect(squadre()).toHaveLength(3);
    expect(store().tappe[0].gironi?.flat().sort()).toEqual(squadre().map((s) => s.id).sort());
  });

  it("registrato: il sorteggio controlla i roster di adesso, non quelli della vista", () => {
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current; // roster ancora vuoti
    act(() => { useAppStore.setState({ tappe: [conRoster(tappa())] }); });
    let errore: string | null = "non eseguito";
    fai(() => { errore = h.sorteggia("casuale"); });
    expect(errore).toBeNull();
    expect(store().tappe[0].gironi).not.toBeNull();
  });

  it("due risultati registrati di seguito restano entrambi", () => {
    useAppStore.setState({ user: ospite, tappe: [sorteggiata([daGiocare("m1"), daGiocare("m2")])] });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    const [m1, m2] = partite();
    fai(() => h.saveScore(m1, { sa: "21", sb: "15", pa: {}, pb: {} }));
    fai(() => h.saveScore(m2, { sa: "10", sb: "21", pa: {}, pb: {} }));
    expect(partite().map((m) => [m.sa, m.sb, m.done])).toEqual([[21, 15, true], [10, 21, true]]);
  });

  it("registrato: il punteggio si controlla sui roster di adesso, non su quelli della vista", () => {
    useAppStore.setState({ tappe: [sorteggiata([daGiocare("m1")])] });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current; // roster ancora vuoti
    act(() => { useAppStore.setState({ tappe: [sorteggiata([daGiocare("m1")], conRoster(tappa()))] }); });
    let errore: string | null = "non eseguito";
    fai(() => { errore = h.saveScore(partite()[0], bozza21a15); });
    expect(errore).toBeNull();
    expect(partite()[0]).toMatchObject({ sa: 21, sb: 15, done: true });
  });

  it("registrato: «Concludi» vede i risultati registrati dopo che la vista ha letto la tappa", async () => {
    useAppStore.setState({ tappe: [sorteggiata([daGiocare("m1")])] });
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current; // partita ancora da giocare
    act(() => { useAppStore.setState({ tappe: [sorteggiata([giocata("m1")])] }); });
    let errore: string | null = "non eseguito";
    await act(async () => { errore = await h.concludi(); });
    expect(errore).toBeNull();
    expect(store().tappe[0].conclusa).toBe(true);
    expect(archivio.pubblica).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", conclusa: true }), expect.anything());
  });

  it("video aggiunti e tolti di seguito si sommano", () => {
    const { result } = renderHook(() => useTappa("t1"));
    const h = result.current;
    fai(() => h.addVideo("Finale", "https://youtu.be/a"));
    fai(() => h.addVideo("Semifinale", "https://youtu.be/b"));
    expect(store().tappe[0].video.map((v) => v.titolo)).toEqual(["Finale", "Semifinale"]);
    const primo = store().tappe[0].video[0];
    fai(() => h.removeVideo(primo.id));
    expect(store().tappe[0].video.map((v) => v.titolo)).toEqual(["Semifinale"]);
  });

  it("su una tappa conclusa il video aggiunto viene ripubblicato nell'archivio", () => {
    useAppStore.setState({ tappe: [{ ...tappa(), conclusa: true }] });
    const { result } = renderHook(() => useTappa("t1"));
    fai(() => result.current.addVideo("Finale", "https://youtu.be/a"));
    expect(archivio.pubblica).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", conclusa: true, video: [expect.objectContaining({ titolo: "Finale" })] }),
      expect.anything(),
    );
  });
});
