// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TappaEditPanel } from "../../src/components/tappa/TappaEditPanel";
import { useTappa } from "../../src/hooks/useTappa";
import { useAppStore } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Partita, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: pannello, hook, store e coda dei salvataggi sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(async (t: Tappa) => t), removeTappa: vi.fn(),
  },
}));

const store = () => useAppStore.getState();
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

/** Partita del girone `g` tra `a` e `b`, giocata (21-15) oppure no */
const partita = (id: string, g: number, a: string, b: string, done: boolean): Partita =>
  ({ id, g, a, b, sa: done ? 21 : 0, sb: done ? 15 : 0, done });

/** Quattro squadre in due gironi già sorteggiati; `giocate` dice se le due partite hanno il risultato */
const tappa = (giocate: boolean): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "Roma", data: "", nGironi: 2, regole: { ...DEFAULT_RULES },
  squadre: ["a", "b", "c", "d"].map((id) => ({ id, nome: `Squadra ${id}`, giocatori: [], rank: "" })),
  gironi: [["a", "d"], ["b", "c"]],
  partite: [partita("m1", 0, "a", "d", giocate), partita("m2", 1, "b", "c", giocate)],
  video: [],
});

/** Il pannello come lo usa la pagina: con l'hook vero, che si aggiorna a ogni modifica dello store */
function Pannello() {
  const h = useTappa("t1");
  if (!h.tappa) return null;
  return <TappaEditPanel h={h} />;
}

function apri(t: Tappa) {
  useAppStore.setState({ user: registrato, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [t] });
  render(<Pannello />);
}

const campoGironi = () => screen.getByLabelText("Numero gironi") as HTMLInputElement;
const scrivi = (campo: HTMLInputElement, testo: string) => fireEvent.change(campo, { target: { value: testo } });
const nelloStore = () => store().tappe[0];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset(); // svuota la coda dei salvataggi
});

describe("TappaEditPanel: numero di gironi (R3)", () => {
  it("si applica all'uscita dal campo, non a ogni tasto", () => {
    apri(tappa(false));
    scrivi(campoGironi(), "1");
    expect(nelloStore().nGironi).toBe(2); // mentre si scrive il sorteggio resta
    expect(nelloStore().gironi).not.toBeNull();
    fireEvent.blur(campoGironi());
    expect(nelloStore()).toMatchObject({ nGironi: 1, gironi: null, partite: [] });
  });

  it("si applica anche con Invio", () => {
    apri(tappa(false));
    scrivi(campoGironi(), "1");
    fireEvent.keyDown(campoGironi(), { key: "Enter" });
    expect(nelloStore().nGironi).toBe(1);
  });

  it("sonda: ridigitare lo stesso numero non ha nessun effetto, risultati compresi", () => {
    apri(tappa(true));
    const prima = nelloStore();
    scrivi(campoGironi(), "");
    scrivi(campoGironi(), "2");
    fireEvent.blur(campoGironi());
    expect(nelloStore()).toBe(prima);
    expect(store().inSospeso).toBe(0);
  });

  it("un numero non valido non cambia niente: compare il messaggio e il campo torna al numero di prima", () => {
    apri(tappa(false));
    const prima = nelloStore();
    scrivi(campoGironi(), "2.5");
    fireEvent.blur(campoGironi());
    expect(screen.getByRole("alert").textContent).toMatch(/Numero di gironi non valido: con 4 squadre deve essere un intero da 1 a 2/);
    expect(campoGironi().value).toBe("2");
    expect(nelloStore()).toBe(prima);
  });
});
