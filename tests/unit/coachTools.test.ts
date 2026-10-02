// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useCoachAI } from "../../src/hooks/useCoachAI";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { archivioApi } from "../../src/services/archivioApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { ToolCall } from "../../src/services/aiService";
import type { Partita, RegSquadra, SquadraTappa, Tappa, User } from "../../src/types";

// Rete finta per leghe, anagrafe e archivio; store, coda dei salvataggi, tappaOps, aiService e hook sono quelli veri.
// Il modello risponde da fetch (POST /api/coach/chat): nessuna chiamata a Groq o al backend veri.
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/services/anagrafeApi")>()),
  anagrafeApi: {
    listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
    listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
  },
}));
vi.mock("../../src/services/archivioApi", () => ({
  archivioApi: { list: vi.fn(), get: vi.fn(), pubblica: vi.fn(), rimuovi: vi.fn() },
}));

/* ── Modello finto ── */

/** Una risposta del modello: il testo finale oppure gli strumenti da eseguire */
interface Risposta { content: string | null; tool_calls?: ToolCall[] }
/** Un messaggio come arriva al modello */
interface Ricevuto { role: string; content: string | null; tool_call_id?: string }

let nChiamate = 0;
/** Il modello chiede di eseguire questi strumenti; gli argomenti in forma di testo simulano un JSON non valido */
function strumenti(...chiamate: [string, Record<string, unknown> | string][]): Risposta {
  return {
    content: null,
    tool_calls: chiamate.map(([name, args]) => {
      nChiamate++;
      let argomenti = JSON.stringify(args);
      if (typeof args === "string") argomenti = args;
      return { id: `call_${nChiamate}`, type: "function", function: { name, arguments: argomenti } };
    }),
  };
}
/** Il modello risponde con questo testo, senza strumenti */
const testo = (content: string): Risposta => ({ content });

/** Modello dietro POST /api/coach/chat: dà le risposte preparate dal test, una per richiesta (una Response passa così
 *  com'è, per simulare un errore del server; una promessa fa aspettare la risposta), e tiene i messaggi di ogni richiesta */
function modello(...risposte: (Risposta | Response | Promise<Risposta>)[]) {
  const richieste: Ricevuto[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    richieste.push(JSON.parse(String(init?.body)).messages);
    const r = await risposte.shift();
    if (!r) throw new Error("il modello finto non ha altre risposte");
    if (r instanceof Response) return r;
    return new Response(JSON.stringify({ choices: [{ message: r }] }));
  }));
  return richieste;
}

/** I risultati degli strumenti come li ha letti il modello nell'ultima richiesta */
const esiti = (richieste: Ricevuto[][]) => richieste.at(-1)!.filter((m) => m.role === "tool").map((m) => m.content);

/** Promessa controllabile a mano: il test decide quando arriva la risposta */
function differita<T>() {
  let ok!: (v: T) => void;
  const p = new Promise<T>((res) => { ok = res; });
  return { p, ok };
}

/* ── Coach ── */

const inRouter = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, null, children);
/** Il Coach dentro un router: gli strumenti aprono le pagine di lega e tappa */
const coach = () => renderHook(() => useCoachAI(), { wrapper: inRouter }).result;
type Coach = ReturnType<typeof coach>;
/** Scrive al Coach e aspetta la risposta */
async function chiedi(c: Coach, messaggio: string) {
  await act(async () => { await c.current.send(messaggio); });
}
/** Scrive al Coach senza aspettare: il test fa qualcosa mentre la richiesta è in corso, poi aspetta `invio` */
function inviaSenzaAspettare(c: Coach, messaggio: string) {
  let invio!: Promise<void>;
  act(() => { invio = c.current.send(messaggio); });
  return invio;
}

/* ── Dati ── */

const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };
const squadra = (id: string, nome: string): SquadraTappa => ({ id, nome, giocatori: [], rank: "" });
const daGiocare = (id: string, a: string, b: string): Partita => ({ id, g: 0, a, b, sa: 0, sb: 0, done: false });
const giocata = (id: string, a: string, b: string, sa: number, sb: number): Partita => ({ id, g: 0, a, b, sa, sb, done: true });
/** «Roma Open»: Alfa, Beta e Gamma in un girone; Alfa-Beta 21-15 giocata, le altre due da giocare */
const romaOpen = (): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "Roma", data: "2026-10-03", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [squadra("s1", "Alfa"), squadra("s2", "Beta"), squadra("s3", "Gamma")],
  gironi: [["s1", "s2", "s3"]],
  partite: [giocata("m1", "s1", "s2", 21, 15), daGiocare("m2", "s1", "s3"), daGiocare("m3", "s2", "s3")],
  video: [],
});

/** Tutte le gare di «Roma Open» giocate: la tappa si può concludere */
const romaOpenGiocata = (): Tappa => ({
  ...romaOpen(),
  partite: [giocata("m1", "s1", "s2", 21, 15), giocata("m2", "s1", "s3", 21, 18), giocata("m3", "s2", "s3", 19, 21)],
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(legheApi.putTappa).mockImplementation(async (t) => t);
  // Anagrafe vuota: ogni squadra nominata in crea_tappa viene registrata, con l'id che darebbe il server
  vi.mocked(anagrafeApi.listSquadre).mockResolvedValue([]);
  vi.mocked(anagrafeApi.listGiocatori).mockResolvedValue([]);
  vi.mocked(anagrafeApi.createSquadra).mockImplementation(async (s) => ({ ...s, id: `reg-${s.nome}`, autore: "Anna", ts: 1 }));
  vi.mocked(archivioApi.pubblica).mockImplementation(async (tappa, lega) => ({ tappa, lega, autore: "Anna", ts: 1 }));
  useAppStore.setState({
    user: registrato, legaId: "l1", legaName: "Circuito", leghe: [{ id: "l1", nome: "Circuito", ts: 1, nTappe: 1 }],
    tappe: [romaOpen()],
  });
});

afterEach(() => {
  cleanup();       // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset(); // svuota la coda dei salvataggi
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("Coach AI: gli strumenti leggono lega, tappe e utente al momento dell'esecuzione", () => {
  it("FC-1: «crea la lega e la tappa» riesce: crea_tappa vede la lega appena creata", async () => {
    useAppStore.setState({ legaId: null, leghe: [], legaName: "", tappe: [] });
    vi.mocked(legheApi.create).mockResolvedValue({ id: "l9", nome: "Circuito Roma", ts: 1, nTappe: 0 });
    modello(
      strumenti(
        ["crea_lega", { nome: "Circuito Roma" }],
        ["crea_tappa", { nome: "Tappa 1", squadre: ["Alfa", "Beta", "Gamma", "Delta"] }],
      ),
      testo("Ho creato la lega Circuito Roma e la Tappa 1."),
    );
    const c = coach();
    await chiedi(c, "Crea la lega Circuito Roma e la Tappa 1 con Alfa, Beta, Gamma e Delta");
    expect(store().legaId).toBe("l9");
    expect(store().tappe).toHaveLength(1);
    expect(store().tappe[0]).toMatchObject({ nome: "Tappa 1", nGironi: 2 });
    expect(store().tappe[0].squadre.map((s) => s.nome)).toEqual(["Alfa", "Beta", "Gamma", "Delta"]);
    expect(c.current.msgs.at(-1)?.tools).toEqual(["crea_lega", "crea_tappa"]);
  });

  it("FC-1: il controllo dei doppioni vede la tappa creata poco prima nella stessa richiesta", async () => {
    const richieste = modello(
      strumenti(["crea_tappa", { nome: "Tappa 2", squadre: ["Alfa", "Beta"] }]),
      strumenti(["crea_tappa", { nome: "Tappa 2", squadre: ["Beta", "Alfa"] }]),
      testo("La Tappa 2 è pronta."),
    );
    const c = coach();
    await chiedi(c, "Crea la Tappa 2 con Alfa e Beta");
    expect(store().tappe.map((t) => t.nome)).toEqual(["Roma Open", "Tappa 2"]);
    expect(esiti(richieste)[1]).toMatch(/esiste già/);
  });

  it("crea_tappa: se durante l'attesa dell'anagrafe si apre un'altra lega, la tappa non finisce lì e il modello lo sa", async () => {
    const anagrafe = differita<RegSquadra[]>();
    vi.mocked(anagrafeApi.listSquadre).mockReturnValue(anagrafe.p);
    const richieste = modello(
      strumenti(["crea_tappa", { nome: "Tappa 2", squadre: ["Alfa", "Beta"] }]),
      testo("La lega è cambiata: non ho creato la tappa."),
    );
    const c = coach();
    const invio = inviaSenzaAspettare(c, "Crea la Tappa 2 con Alfa e Beta");
    await waitFor(() => expect(anagrafeApi.listSquadre).toHaveBeenCalled());
    act(() => { useAppStore.setState({ legaId: "l2", legaName: "Altra lega", tappe: [] }); });
    await act(async () => {
      anagrafe.ok([]);
      await invio;
    });
    expect(store().tappe).toEqual([]);
    expect(store().inSospeso).toBe(0);
    expect(esiti(richieste)[0]).toMatch(/lega aperta è cambiata/);
  });

  it("concludi_tappa pubblica con il nome della lega di adesso, non con quello che aveva all'invio", async () => {
    useAppStore.setState({ tappe: [romaOpenGiocata()] });
    const risposta = differita<Risposta>();
    modello(risposta.p, testo("Roma Open è conclusa e pubblicata."));
    const c = coach();
    const invio = inviaSenzaAspettare(c, "Concludi Roma Open");
    // Mentre il modello pensa, la lega cambia nome
    act(() => { useAppStore.setState({ legaName: "Circuito Lazio" }); });
    await act(async () => {
      risposta.ok(strumenti(["concludi_tappa", { tappa_nome: "Roma Open" }]));
      await invio;
    });
    expect(archivioApi.pubblica).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", conclusa: true }), "Circuito Lazio");
  });
});

describe("Coach AI: argomenti mancanti o non validi → nessuna azione, il modello sa che cosa manca", () => {
  /** Esegue lo strumento e controlla che il modello abbia ricevuto l'errore e che non ci sia il badge dell'azione */
  async function rifiutato(strumento: string, args: Record<string, unknown>, motivo: RegExp) {
    const richieste = modello(strumenti([strumento, args]), testo("Non ho potuto farlo."));
    const c = coach();
    await chiedi(c, "Fallo, coach");
    expect(esiti(richieste)[0]).toMatch(motivo);
    expect(c.current.msgs.at(-1)).toEqual({ role: "assistant", content: "Non ho potuto farlo." });
  }

  it.each<[string, Record<string, unknown>]>([
    ["senza i nomi", { punti_a: 21, punti_b: 18 }],
    ["con la prima squadra vuota", { squadra_a: "", punti_a: 21, squadra_b: "Gamma", punti_b: 18 }],
    ["con la seconda squadra di soli spazi", { squadra_a: "Alfa", punti_a: 21, squadra_b: "   ", punti_b: 18 }],
  ])("FC-2: registra_risultato %s non tocca nessuna partita", async (_caso, args) => {
    const prima = store().tappe[0];
    await rifiutato("registra_risultato", args, /Manca il nome della (prima|seconda) squadra/);
    expect(store().tappe[0]).toBe(prima);
  });

  it("FC-2: annulla_risultato senza i nomi non tocca nessuna partita", async () => {
    const prima = store().tappe[0];
    await rifiutato("annulla_risultato", {}, /Manca il nome della prima squadra/);
    expect(store().tappe[0]).toBe(prima);
  });

  it.each<[string, Record<string, unknown>]>([
    ["registra_squadra", { citta: "Roma" }],
    ["registra_giocatore", { cognome: "Rossi" }],
    ["registra_giocatore", { nome: "Luca", cognome: " " }],
    ["aggiorna_squadra", { citta: "Roma" }],
  ])("%s senza nome non scrive niente nell'anagrafe condivisa", async (strumento, args) => {
    await rifiutato(strumento, args, /Manca il (nome|cognome)/);
    expect(anagrafeApi.createSquadra).not.toHaveBeenCalled();
    expect(anagrafeApi.createGiocatore).not.toHaveBeenCalled();
    expect(anagrafeApi.updateSquadra).not.toHaveBeenCalled();
  });

  it.each<[string, unknown, RegExp]>([
    ["negativo", -3, /Inserisci entrambi i punteggi/],
    ["decimale", 21.5, /Inserisci entrambi i punteggi/],
    ["decimale scritto come testo", "21.5", /Inserisci entrambi i punteggi/],
    ["fuori scala", 40, /Punteggio insolito/],
  ])("i punteggi anomali restano rifiutati (%s): nessuna partita cambia e nessun badge «Risultato registrato»", async (_caso, punti, motivo) => {
    const prima = store().tappe[0];
    await rifiutato("registra_risultato", { squadra_a: "Alfa", punti_a: punti, squadra_b: "Gamma", punti_b: 18 }, motivo);
    expect(store().tappe[0]).toBe(prima);
  });

  /** `n` nomi di squadra diversi */
  const nomi = (n: number) => Array.from({ length: n }, (_, i) => `Squadra ${i + 1}`);

  it.each<[string, Record<string, unknown>, RegExp]>([
    ["una squadra sola", { nome: "Tappa 2", squadre: ["Alfa"] }, /da 2 a 64 squadre/],
    ["65 squadre", { nome: "Tappa 2", squadre: nomi(65) }, /da 2 a 64 squadre/],
    ["gironi non interi", { nome: "Tappa 2", squadre: nomi(8), nGironi: 2.5 }, /Numero di gironi non valido/],
    ["più gironi che coppie di squadre", { nome: "Tappa 2", squadre: nomi(6), nGironi: 4 }, /Numero di gironi non valido/],
    ["un nome vuoto nell'elenco", { nome: "Tappa 2", squadre: ["Alfa", " ", "Gamma"] }, /nome vuoto/],
    ["senza elenco", { nome: "Tappa 2" }, /Manca l'elenco delle squadre/],
  ])("crea_tappa (%s): nessuna tappa e nessuna squadra registrata in anagrafe", async (_caso, args, motivo) => {
    await rifiutato("crea_tappa", args, motivo);
    expect(store().tappe.map((t) => t.nome)).toEqual(["Roma Open"]);
    expect(anagrafeApi.createSquadra).not.toHaveBeenCalled();
  });

  it.each([[4, 2], [3, 1]])("crea_tappa senza numero di gironi: con %i squadre ne fa %i", async (nSquadre, nGironi) => {
    modello(strumenti(["crea_tappa", { nome: "Tappa 2", squadre: nomi(nSquadre) }]), testo("Fatto."));
    const c = coach();
    await chiedi(c, "Crea la Tappa 2");
    expect(store().tappe[1]).toMatchObject({ nome: "Tappa 2", nGironi });
  });

  it("FC-3: senza tappa indicata il sorteggio non tocca l'ultima tappa se è conclusa", async () => {
    useAppStore.setState({ tappe: [{ ...romaOpenGiocata(), conclusa: true }] });
    const prima = store().tappe[0];
    await rifiutato("sorteggia_gironi", {}, /La tappa è conclusa: riaprila per modificarla/);
    expect(store().tappe[0]).toBe(prima);
  });
});

describe("Coach AI: uno strumento che fallisce non interrompe la richiesta", () => {
  it("l'errore diventa il risultato dello strumento: gli strumenti dopo vanno avanti e il modello spiega", async () => {
    vi.mocked(anagrafeApi.createSquadra).mockRejectedValue(new ApiError(403, "Non hai i permessi per questa operazione"));
    const richieste = modello(
      strumenti(
        ["registra_squadra", { nome: "Delta" }],
        ["registra_risultato", { squadra_a: "Alfa", punti_a: 21, squadra_b: "Gamma", punti_b: 18 }],
      ),
      testo("Risultato registrato; la squadra Delta non è stata registrata: mancano i permessi."),
    );
    const c = coach();
    await chiedi(c, "Registra la squadra Delta e il risultato Alfa 21 Gamma 18");
    expect(store().tappe[0].partite[1]).toMatchObject({ sa: 21, sb: 18, done: true });
    expect(esiti(richieste)[0]).toContain("Non hai i permessi per questa operazione");
    // Solo l'azione riuscita ha il badge sotto la risposta
    expect(c.current.msgs.at(-1)).toEqual({
      role: "assistant",
      content: "Risultato registrato; la squadra Delta non è stata registrata: mancano i permessi.",
      tools: ["registra_risultato"],
    });
  });

  it("la stessa chiamata dopo un errore non si ripete e il modello non la legge come eseguita", async () => {
    vi.mocked(anagrafeApi.createSquadra).mockRejectedValue(new ApiError(403, "Non hai i permessi per questa operazione"));
    const richieste = modello(
      strumenti(["registra_squadra", { nome: "Delta" }]),
      strumenti(["registra_squadra", { nome: "Delta" }]),
      testo("Non ho i permessi per registrare Delta."),
    );
    const c = coach();
    await chiedi(c, "Registra la squadra Delta");
    expect(anagrafeApi.createSquadra).toHaveBeenCalledTimes(1);
    expect(esiti(richieste)[1]).not.toContain("eseguita");
  });

  it.each([
    ["JSON interrotto", '{"tappa_nome": "Roma'],
    ["null", "null"],
    ["un elenco", "[]"],
  ])("argomenti non validi (%s): lo strumento non parte e il modello lo sa", async (_caso, argomenti) => {
    const prima = store().tappe[0];
    const richieste = modello(strumenti(["sorteggia_gironi", argomenti]), testo("Non sono riuscito a leggere la richiesta."));
    const c = coach();
    await chiedi(c, "Rifai il sorteggio di Roma Open");
    expect(store().tappe[0]).toBe(prima);
    expect(esiti(richieste)[0]).toMatch(/Argomenti non validi/);
    expect(c.current.msgs.at(-1)).toEqual({ role: "assistant", content: "Non sono riuscito a leggere la richiesta." });
  });
});

describe("Coach AI: errori del server", () => {
  it("un 400 arriva all'utente con il messaggio del server (conversazione troppo lunga)", async () => {
    modello(new Response(
      JSON.stringify({ message: "Conversazione troppo lunga: cancella la chat e riprova", timestamp: "2026-10-02T10:00:00" }),
      { status: 400 },
    ));
    const c = coach();
    await chiedi(c, "Come si organizza un girone?");
    expect(c.current.msgs.at(-1)).toEqual({ role: "assistant", content: "Conversazione troppo lunga: cancella la chat e riprova" });
  });
});
