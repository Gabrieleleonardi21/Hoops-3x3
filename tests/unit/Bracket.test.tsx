// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Bracket } from "../../src/components/gironi/Bracket";
import type { BracketMatch } from "../../src/types";

afterEach(cleanup); // senza le globali di Vitest, Testing Library non smonta da sola

const NOMI: Record<string, string> = { a: "Alfa", b: "Beta", c: "Gamma", d: "Delta" };
/** Un posto ancora senza squadra (il vincitore del turno prima non c'è ancora) si chiama TBD, come in BracketSection */
const nameOf = (id: string | null) => {
  if (!id) return "TBD";
  return NOMI[id];
};

/** Un match del tabellone; `pA` e `pB` contano solo se è giocato */
function match(id: string, label: string, squadraA: string | null, squadraB: string | null, esito: Partial<BracketMatch> = {}): BracketMatch {
  return { id, label, squadraA, squadraB, pA: 0, pB: 0, done: false, ...esito };
}

/** Due semifinali (la prima giocata: Alfa batte Delta 21-15) e la finale con Alfa già dentro */
const tabellone = (): BracketMatch[][] => [
  [
    match("sf1", "Semifinale 1", "a", "d", { pA: 21, pB: 15, done: true }),
    match("sf2", "Semifinale 2", "b", "c"),
  ],
  [match("fin", "Finale", "a", null)],
];

/** La riga di una squadra dentro il suo match: il nome e il punteggio stanno nella stessa riga */
const riga = (nome: string) => screen.getByText(nome).parentElement as HTMLElement;
/** La card di un match, dall'etichetta */
const card = (etichetta: string) => screen.getByText(etichetta).closest("div.overflow-hidden") as HTMLElement;

describe("Bracket: colonne e nomi", () => {
  it("una colonna per round, con il titolo senza il numero del match", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    expect(screen.getByText("Semifinale")).toBeTruthy(); // «Semifinale 1» e «Semifinale 2» sono le etichette dei match
    expect(screen.getAllByText("Finale")).toHaveLength(2); // titolo della colonna e etichetta del match
    expect(screen.getByText("Semifinale 1")).toBeTruthy();
    expect(screen.getByText("Semifinale 2")).toBeTruthy();
  });

  it("un posto ancora vuoto si chiama TBD e ha il nome attenuato", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    const tbd = screen.getByText("TBD");
    expect(tbd.classList.contains("text-chalk-dim")).toBe(true);
    expect(screen.getByText("Beta").classList.contains("text-chalk-dim")).toBe(false);
  });

  it("il logo della squadra, se ce l'ha, compare nella sua riga", () => {
    const logoOf = (id: string | null) => {
      if (id === "a") return "https://example.com/alfa.png";
      return undefined;
    };
    render(<Bracket rounds={tabellone()} nameOf={nameOf} logoOf={logoOf} />);
    // Alfa è in due match (semifinale e finale): il logo c'è in tutte e due le righe
    const loghi = screen.getAllByText("Alfa").map((nome) => nome.parentElement?.querySelector("img")?.getAttribute("src"));
    expect(loghi).toEqual(["https://example.com/alfa.png", "https://example.com/alfa.png"]);
    expect(riga("Beta").querySelector("img")).toBeNull();
  });
});

describe("Bracket: match giocato e da giocare", () => {
  it("chi ha vinto ha la riga in evidenza, il segno di spunta e il punteggio in colore; chi ha perso è attenuato", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    const sf1 = within(card("Semifinale 1"));
    const vincitore = sf1.getByText("Alfa").parentElement as HTMLElement;
    const perdente = sf1.getByText("Delta").parentElement as HTMLElement;
    expect(vincitore.classList.contains("bg-asphalt-800")).toBe(true);
    expect(vincitore.querySelector("svg")).not.toBeNull();
    expect(sf1.getByText("21").classList.contains("text-court")).toBe(true);
    expect(perdente.classList.contains("bg-asphalt-800")).toBe(false);
    expect(perdente.querySelector("svg")).toBeNull();
    expect(sf1.getByText("Delta").classList.contains("text-chalk-dim")).toBe(true);
    expect(sf1.getByText("15").classList.contains("text-chalk-dim")).toBe(true);
  });

  it("vale anche quando vince la squadra B", () => {
    const rounds = [[match("sf1", "Semifinale 1", "a", "d", { pA: 9, pB: 21, done: true })]];
    render(<Bracket rounds={rounds} nameOf={nameOf} />);
    expect(riga("Delta").classList.contains("bg-asphalt-800")).toBe(true);
    expect(riga("Alfa").classList.contains("bg-asphalt-800")).toBe(false);
  });

  it("un match da giocare non ha vincitore né perdente e al posto dei punti c'è un trattino", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    const sf2 = within(card("Semifinale 2"));
    expect(sf2.getAllByText("–")).toHaveLength(2);
    expect(riga("Beta").classList.contains("bg-asphalt-800")).toBe(false);
    expect(riga("Beta").querySelector("svg")).toBeNull();
    expect(riga("Gamma").querySelector("svg")).toBeNull();
  });
});

describe("Bracket: turno superato d'ufficio (bye)", () => {
  /** Alfa passa il turno senza giocare; Beta e Gamma giocano la semifinale */
  const conBye = () => [
    [
      match("sf1", "Semifinale 1", "a", null, { done: true, bye: true }),
      match("sf2", "Semifinale 2", "b", "c"),
    ],
    [match("fin", "Finale", "a", null)],
  ];

  it("la squadra presente passa il turno: nome in evidenza, «Passa il turno» al posto dell'avversaria, nessun punteggio", () => {
    render(<Bracket rounds={conBye()} nameOf={nameOf} />);
    const sf1 = within(card("Semifinale 1"));
    expect(sf1.getByText("Passa il turno")).toBeTruthy();
    expect((sf1.getByText("Alfa").parentElement as HTMLElement).classList.contains("bg-asphalt-800")).toBe(true);
    expect(sf1.queryByText("TBD")).toBeNull(); // il posto vuoto non è un «da determinare»: la squadra non ha avversaria
    expect(sf1.getAllByText("–")).toHaveLength(1); // solo il punteggio di Alfa, che non c'è
  });

  it("se l'unica squadra è la B passa lo stesso il turno", () => {
    const rounds = [[match("sf1", "Semifinale 1", null, "d", { done: true, bye: true })]];
    render(<Bracket rounds={rounds} nameOf={nameOf} />);
    expect(screen.getByText("Passa il turno")).toBeTruthy();
    expect(riga("Delta").classList.contains("bg-asphalt-800")).toBe(true);
  });

  it("un match senza «bye» non dice mai «Passa il turno»", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    expect(screen.queryByText("Passa il turno")).toBeNull();
  });

  it("il match bye non ha i controlli di inserimento: non si gioca", () => {
    render(<Bracket rounds={conBye()} nameOf={nameOf} renderControls={(m) => <button>Gioca {m.label}</button>} />);
    expect(screen.queryByRole("button", { name: "Gioca Semifinale 1" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gioca Semifinale 2" })).toBeTruthy();
  });
});

describe("Bracket: campione", () => {
  /** La finale giocata tra Alfa e Beta */
  const conFinale = (pA: number, pB: number): BracketMatch[][] => [[match("fin", "Finale", "a", "b", { pA, pB, done: true })]];

  it("la finale giocata ha il segno «Campione», chiunque vinca", () => {
    const { unmount } = render(<Bracket rounds={conFinale(21, 18)} nameOf={nameOf} />);
    expect(screen.getByText("Campione")).toBeTruthy();
    unmount();
    render(<Bracket rounds={conFinale(18, 21)} nameOf={nameOf} />);
    expect(screen.getByText("Campione")).toBeTruthy();
  });

  it("la finale ancora da giocare non lo ha", () => {
    render(<Bracket rounds={[[match("fin", "Finale", "a", "b")]]} nameOf={nameOf} />);
    expect(screen.queryByText("Campione")).toBeNull();
  });

  it("una semifinale giocata non lo ha", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    expect(screen.queryByText("Campione")).toBeNull();
  });
});

describe("Bracket: controlli di inserimento", () => {
  const controlli = (m: BracketMatch) => <button>Gioca {m.label}</button>;

  it("compaiono solo per i match da giocare con tutte e due le squadre note", () => {
    // sf1 è giocata, sf2 è da giocare con tutte e due le squadre, la finale ha ancora un posto vuoto
    render(<Bracket rounds={tabellone()} nameOf={nameOf} renderControls={controlli} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Gioca Semifinale 2" })).toBeTruthy();
  });

  it("senza renderControls (sola lettura) non c'è nessun controllo, nemmeno per i match da giocare", () => {
    render(<Bracket rounds={tabellone()} nameOf={nameOf} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
