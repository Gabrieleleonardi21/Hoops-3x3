// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SquadraCard } from "../../src/components/squadra/SquadraCard";
import { useTappa } from "../../src/hooks/useTappa";
import { useAppStore } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { AVVISO_GIOCATORE_RIPETUTO, AVVISO_SQUADRA_OMONIMA } from "../../src/utils/testi";
import type { GiocatoreRoster, SquadraTappa, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe: la card e l'hook della tappa sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(async (t: Tappa) => t), removeTappa: vi.fn(),
  },
}));

const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

/** La card con l'hook della tappa vero, come nella pagina */
function Carta({ s, omonima }: { s: SquadraTappa; omonima?: boolean }) {
  const h = useTappa("t1");
  return <SquadraCard s={s} index={0} h={h} omonima={omonima} />;
}

/** Mostra la squadra `s` nella tappa t1, insieme a un'altra squadra */
function apri(s: SquadraTappa, omonima?: boolean) {
  const tappa: Tappa = {
    id: "t1", nome: "Roma Open", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
    squadre: [s, { id: "s2", nome: "Torino", giocatori: [], rank: "" }], gironi: null, partite: [], video: [],
  };
  useAppStore.setState({ user: registrato, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [tappa] });
  render(<Carta s={s} omonima={omonima} />);
}

/** Una squadra «Roma» con il roster dato */
const roma = (giocatori: GiocatoreRoster[]): SquadraTappa => ({ id: "s1", nome: "Roma", giocatori, rank: "" });

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
});

describe("SquadraCard: due giocatori con lo stesso nome nella rosa", () => {
  it("l'avviso compare sotto ciascuno dei due", () => {
    apri(roma([{ id: "p1", nome: "Mario Rossi" }, { id: "p2", nome: "mario rossi" }, { id: "p3", nome: "Luca" }]));
    expect(screen.getAllByText(AVVISO_GIOCATORE_RIPETUTO)).toHaveLength(2);
  });

  it("con regId diversi sono due persone: nessun avviso", () => {
    apri(roma([{ id: "p1", nome: "Mario Rossi", regId: "g1" }, { id: "p2", nome: "Mario Rossi", regId: "g2" }]));
    expect(screen.queryByText(AVVISO_GIOCATORE_RIPETUTO)).toBeNull();
  });

  it("le righe vuote non avvisano", () => {
    apri(roma([{ id: "p1", nome: "" }, { id: "p2", nome: "" }]));
    expect(screen.queryByText(AVVISO_GIOCATORE_RIPETUTO)).toBeNull();
  });
});

describe("SquadraCard: squadra omonima in tappa", () => {
  it("con omonima l'avviso compare come testo sotto il nome", () => {
    apri(roma([]), true);
    expect(screen.getByText(AVVISO_SQUADRA_OMONIMA)).toBeTruthy();
  });

  it("senza omonima non compare", () => {
    apri(roma([]));
    expect(screen.queryByText(AVVISO_SQUADRA_OMONIMA)).toBeNull();
  });
});
