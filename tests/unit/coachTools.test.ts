// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useCoachAI } from "../../src/hooks/useCoachAI";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { ToolCall } from "../../src/services/aiService";
import type { Partita, SquadraTappa, Tappa, User } from "../../src/types";

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
 *  com'è, per simulare un errore del server), e tiene i messaggi di ogni richiesta */
function modello(...risposte: (Risposta | Response)[]) {
  const richieste: Ricevuto[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    richieste.push(JSON.parse(String(init?.body)).messages);
    const r = risposte.shift();
    if (!r) throw new Error("il modello finto non ha altre risposte");
    if (r instanceof Response) return r;
    return new Response(JSON.stringify({ choices: [{ message: r }] }));
  }));
  return richieste;
}

/** I risultati degli strumenti come li ha letti il modello nell'ultima richiesta */
const esiti = (richieste: Ricevuto[][]) => richieste.at(-1)!.filter((m) => m.role === "tool").map((m) => m.content);

/* ── Coach ── */

const inRouter = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, null, children);
/** Il Coach dentro un router: gli strumenti aprono le pagine di lega e tappa */
const coach = () => renderHook(() => useCoachAI(), { wrapper: inRouter }).result;
type Coach = ReturnType<typeof coach>;
/** Scrive al Coach e aspetta la risposta */
async function chiedi(c: Coach, messaggio: string) {
  await act(async () => { await c.current.send(messaggio); });
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(legheApi.putTappa).mockImplementation(async (t) => t);
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
