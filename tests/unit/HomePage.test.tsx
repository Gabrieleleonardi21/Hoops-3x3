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

const apriHome = (partite: Partita[]) => {
  useAppStore.setState({ user: registrato, legaId: "l1", legaName: "Lega", tappe: [tappa(partite)], ready: true });
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  return screen.getByText("Ultimo risultato").closest("div.rounded") as HTMLElement;
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
