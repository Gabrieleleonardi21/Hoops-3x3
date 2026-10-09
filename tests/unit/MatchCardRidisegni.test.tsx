// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TappaPage } from "../../src/pages/TappaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { creaTappa, sorteggia } from "../../src/domain/tappaOps";
import type { Tappa, User } from "../../src/types";

/* Misura dei ridisegni (F11): una tappa grande (16 squadre in 2 gironi da 8 = 56 partite; con 4 gironi, 112, il test in jsdom
 * supera i 30 s dentro la suite completa) e un tasto scritto nel nome di una squadra. Prima della correzione ogni tasto
 * ridisegnava tutte le schede delle partite (con i loro tabellini: centinaia di campi); dopo, solo le 7 schede della squadra
 * rinominata. Si contano i disegni di ScoreCard, che ogni scheda di partita disegna una volta: la si avvolge in un contatore e
 * si lascia com'è. */
let disegni = 0;
vi.mock("../../src/components/partita/ScoreCard", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/components/partita/ScoreCard")>();
  return {
    ...reale,
    ScoreCard: (props: Parameters<typeof reale.ScoreCard>[0]) => {
      disegni++;
      return <reale.ScoreCard {...props} />;
    },
  };
});

const ospite: User = { name: "Ospite", guest: true };
const N_SQUADRE = 16;
const N_GIRONI = 2;
/** 2 gironi da 8: 28 partite a girone, 56 in tutto */
const N_PARTITE = N_GIRONI * (8 * 7) / 2;

/** La tappa sorteggiata, con 3 giocatori per squadra (così ogni scheda ha i tabellini) */
function tappaGrande(): Tappa {
  const squadre = Array.from({ length: N_SQUADRE }, (_, i) => ({
    id: `s${i}`, nome: `Squadra ${i + 1}`, rank: "",
    giocatori: Array.from({ length: 3 }, (_, j) => ({ id: `s${i}p${j}`, nome: `Giocatore ${j + 1}` })),
  }));
  const creata = creaTappa({ nome: "Roma Open", luogo: "", data: "", nGironi: N_GIRONI, squadre });
  if (!creata.ok) throw new Error(creata.errore);
  const sorteggiata = sorteggia({ ...creata.tappa, id: "t1" }, "casuale");
  if (!sorteggiata.ok) throw new Error(sorteggiata.errore);
  return sorteggiata.tappa;
}

beforeEach(() => {
  disegni = 0;
  useAppStore.setState({ user: ospite, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [tappaGrande()] });
  useAnagrafeStore.setState({ giocatori: [], squadre: [], errore: null, caricata: true });
});

afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
});

describe("TappaPage: quante schede di partita si ridisegnano a ogni tasto (F11)", () => {
  it("scrivere nel nome di una squadra ridisegna solo le schede delle sue partite, non tutte e 56", () => {
    const inizio = performance.now();
    render(
      <MemoryRouter initialEntries={["/lega/tappa/t1"]}>
        <Routes><Route path="/lega/tappa/:id" element={<TappaPage />} /></Routes>
      </MemoryRouter>,
    );
    const primoDisegno = performance.now() - inizio;
    expect(useAppStore.getState().tappe[0].partite).toHaveLength(N_PARTITE);
    expect(disegni).toBe(N_PARTITE);

    disegni = 0;
    const campo = screen.getAllByLabelText("Nome squadra")[0];
    const prima = performance.now();
    fireEvent.change(campo, { target: { value: "Falchi" } });
    const unTasto = performance.now() - prima;
    // Un numero per il rapporto: quante schede si sono ridisegnate e quanto è durato il tasto
    console.info(`[F11] primo disegno ${primoDisegno.toFixed(0)} ms; un tasto nel nome: ${disegni} schede ridisegnate in ${unTasto.toFixed(0)} ms`);
    expect(useAppStore.getState().tappe[0].squadre[0].nome).toBe("Falchi");
    // La squadra rinominata gioca 7 partite nel suo girone: solo quelle schede cambiano
    expect(disegni).toBe(7);
  }, 60_000); // 56 schede con i tabellini: in jsdom il primo disegno da solo supera i 5 secondi di base, e la suite gira in parallelo
});
