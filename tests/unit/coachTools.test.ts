// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useCoachAI } from "../../src/hooks/useCoachAI";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
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
