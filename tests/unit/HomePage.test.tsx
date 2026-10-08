// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../src/pages/HomePage";
import { useAppStore } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Partita, Tappa, User } from "../../src/types";

const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

/** Tre squadre in un girone già sorteggiato, con queste partite */
const tappa = (partite: Partita[]): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [
    { id: "s1", nome: "Alfa", giocatori: [], rank: "" },
    { id: "s2", nome: "Beta", giocatori: [], rank: "" },
    { id: "s3", nome: "Gamma", giocatori: [], rank: "" },
  ],
  gironi: [["s1", "s2", "s3"]], partite, video: [],
});

/** La scheda «Ultimo risultato»: il più piccolo antenato dell'intestazione che contiene anche il nome di una squadra. Si trova dal
 *  testo, non dalle classi di stile né dal numero di livelli del markup, che possono cambiare senza cambiare ciò che l'utente vede */
function schedaUltimoRisultato(): HTMLElement {
  let nodo = screen.getByText("Ultimo risultato").parentElement;
  while (nodo && !/Alfa|Beta|Gamma/.test(nodo.textContent ?? "")) nodo = nodo.parentElement;
  if (!nodo) throw new Error("la scheda «Ultimo risultato» non mostra nessuna squadra");
  return nodo;
}

const apriHome = (partite: Partita[]) => {
  useAppStore.setState({ user: registrato, legaId: "l1", legaName: "Lega", tappe: [tappa(partite)], ready: true });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  return schedaUltimoRisultato();
};

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
});

describe("HomePage: «Ultimo risultato» segue l'ordine d'inserimento (FD-10)", () => {
  it("è la partita registrata per ultima, anche se nel calendario viene prima", () => {
    const carta = apriHome([
      { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true, ts: 3000 }, // registrata per ultima
      { id: "m2", g: 0, a: "s1", b: "s3", sa: 10, sb: 21, done: true, ts: 1000 },
      { id: "m3", g: 0, a: "s2", b: "s3", sa: 0, sb: 0, done: false },
    ]);
    expect(within(carta).getByText("Alfa")).toBeTruthy();
    expect(within(carta).getByText("Beta")).toBeTruthy();
    expect(within(carta).queryByText("Gamma")).toBeNull();
  });

  it("con i dati vecchi, senza momento di registrazione, resta l'ultima giocata del calendario", () => {
    const carta = apriHome([
      { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true },
      { id: "m2", g: 0, a: "s1", b: "s3", sa: 10, sb: 21, done: true },
      { id: "m3", g: 0, a: "s2", b: "s3", sa: 0, sb: 0, done: false },
    ]);
    expect(within(carta).getByText("Gamma")).toBeTruthy();
    expect(within(carta).queryByText("Beta")).toBeNull();
  });
});

describe("HomePage: con la fase finale le prossime partite e il conteggio delle gare la includono", () => {
  /** Due gironi conclusi e il tabellone: semifinali da giocare, finale da definire */
  const conTabellone = (): Tappa => ({
    ...tappa([
      { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true, ts: 1 },
      { id: "m2", g: 1, a: "s3", b: "s4", sa: 21, sb: 18, done: true, ts: 2 },
    ]),
    nGironi: 2,
    squadre: [
      { id: "s1", nome: "Alfa", giocatori: [], rank: "" },
      { id: "s2", nome: "Beta", giocatori: [], rank: "" },
      { id: "s3", nome: "Gamma", giocatori: [], rank: "" },
      { id: "s4", nome: "Delta", giocatori: [], rank: "" },
    ],
    gironi: [["s1", "s2"], ["s3", "s4"]],
    bracket: [
      { id: "sf1", label: "Semifinale 1", squadraA: "s1", squadraB: "s4", pA: 0, pB: 0, done: false },
      { id: "sf2", label: "Semifinale 2", squadraA: "s3", squadraB: "s2", pA: 0, pB: 0, done: false },
      { id: "fin", label: "Finale", squadraA: null, squadraB: null, pA: 0, pB: 0, done: false },
    ],
  });

  it("mostra le semifinali da giocare, non «Nessuna partita in attesa»", () => {
    useAppStore.setState({ user: registrato, legaId: "l1", legaName: "Lega", tappe: [conTabellone()], ready: true });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.queryByText("Nessuna partita in attesa.")).toBeNull();
    expect(screen.getByText("Semifinale 1")).toBeTruthy();
    expect(screen.getByText("Semifinale 2")).toBeTruthy();
    // la finale ha ancora i posti vuoti: non è in programma
    expect(screen.queryByText("Finale")).toBeNull();
  });

  it("conta le gare della fase finale e la tappa resta «Live»", () => {
    useAppStore.setState({ user: registrato, legaId: "l1", legaName: "Lega", tappe: [conTabellone()], ready: true });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/2\/5 gare giocate/)).toBeTruthy();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
  });
});
