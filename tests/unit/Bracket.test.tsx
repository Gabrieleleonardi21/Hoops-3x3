// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import type { ComponentProps } from "react";
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

/** Mostra il tabellone (di prova, se non se ne dà un altro); `extra` aggiunge le proprietà facoltative: logoOf, renderControls */
function mostra(rounds: BracketMatch[][] = tabellone(), extra: Partial<ComponentProps<typeof Bracket>> = {}) {
  return render(<Bracket rounds={rounds} nameOf={nameOf} {...extra} />);
}

/** La riga di una squadra dentro il suo match: il nome e il punteggio stanno nella stessa riga */
const riga = (nome: string) => screen.getByText(nome).parentElement as HTMLElement;
/** La card di un match, dall'etichetta */
const card = (etichetta: string) => screen.getByText(etichetta).closest("div.overflow-hidden") as HTMLElement;

/* Come il tabellone segna le cose, in un posto solo: se le classi di stile cambiano si cambia qui e non nei test */
/** La riga di chi ha vinto (o di chi passa il turno) ha lo sfondo in evidenza */
const inEvidenza = (rigaSquadra: HTMLElement) => rigaSquadra.classList.contains("bg-asphalt-800");
/** Accanto a chi ha vinto c'è il segno di spunta */
const haSpunta = (rigaSquadra: HTMLElement) => rigaSquadra.querySelector("svg") !== null;
/** Nome o punteggio attenuati: di chi ha perso o di un posto ancora vuoto */
const attenuato = (elemento: HTMLElement) => elemento.classList.contains("text-chalk-dim");
/** Il punteggio di chi ha vinto è nel colore dell'accento */
const punteggioVincente = (elemento: HTMLElement) => elemento.classList.contains("text-court");

describe("Bracket: colonne e nomi", () => {
  it("una colonna per round, con il titolo senza il numero del match", () => {
    mostra();
    expect(screen.getByText("Semifinale")).toBeTruthy(); // «Semifinale 1» e «Semifinale 2» sono le etichette dei match
    expect(screen.getAllByText("Finale")).toHaveLength(2); // titolo della colonna e etichetta del match
    expect(screen.getByText("Semifinale 1")).toBeTruthy();
    expect(screen.getByText("Semifinale 2")).toBeTruthy();
  });

  it("un posto ancora vuoto si chiama TBD e ha il nome attenuato", () => {
    mostra();
    expect(attenuato(screen.getByText("TBD"))).toBe(true);
    expect(attenuato(screen.getByText("Beta"))).toBe(false);
  });

  it("il logo della squadra, se ce l'ha, compare nella sua riga", () => {
    const logoOf = (id: string | null) => {
      if (id === "a") return "https://example.com/alfa.png";
      return undefined;
    };
    mostra(tabellone(), { logoOf });
    // Alfa è in due match (semifinale e finale): il logo c'è in tutte e due le righe
    const loghi = screen.getAllByText("Alfa").map((nome) => nome.parentElement?.querySelector("img")?.getAttribute("src"));
    expect(loghi).toEqual(["https://example.com/alfa.png", "https://example.com/alfa.png"]);
    expect(riga("Beta").querySelector("img")).toBeNull();
  });
});

describe("Bracket: match giocato e da giocare", () => {
  it("chi ha vinto ha la riga in evidenza, il segno di spunta e il punteggio in colore; chi ha perso è attenuato", () => {
    mostra();
    const sf1 = within(card("Semifinale 1"));
    const vincitore = sf1.getByText("Alfa").parentElement as HTMLElement;
    const perdente = sf1.getByText("Delta").parentElement as HTMLElement;
    expect(inEvidenza(vincitore)).toBe(true);
    expect(haSpunta(vincitore)).toBe(true);
    expect(punteggioVincente(sf1.getByText("21"))).toBe(true);
    expect(inEvidenza(perdente)).toBe(false);
    expect(haSpunta(perdente)).toBe(false);
    expect(attenuato(sf1.getByText("Delta"))).toBe(true);
    expect(attenuato(sf1.getByText("15"))).toBe(true);
  });

  it("vale anche quando vince la squadra B", () => {
    mostra([[match("sf1", "Semifinale 1", "a", "d", { pA: 9, pB: 21, done: true })]]);
    expect(inEvidenza(riga("Delta"))).toBe(true);
    expect(inEvidenza(riga("Alfa"))).toBe(false);
  });

  it("un match da giocare non ha vincitore né perdente e al posto dei punti c'è un trattino", () => {
    mostra();
    const sf2 = within(card("Semifinale 2"));
    expect(sf2.getAllByText("–")).toHaveLength(2);
    expect(inEvidenza(riga("Beta"))).toBe(false);
    expect(haSpunta(riga("Beta"))).toBe(false);
    expect(haSpunta(riga("Gamma"))).toBe(false);
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
    mostra(conBye());
    const sf1 = within(card("Semifinale 1"));
    expect(sf1.getByText("Passa il turno")).toBeTruthy();
    expect(inEvidenza(sf1.getByText("Alfa").parentElement as HTMLElement)).toBe(true);
    expect(sf1.queryByText("TBD")).toBeNull(); // il posto vuoto non è un «da determinare»: la squadra non ha avversaria
    expect(sf1.getAllByText("–")).toHaveLength(1); // solo il punteggio di Alfa, che non c'è
  });

  it("se l'unica squadra è la B passa lo stesso il turno", () => {
    mostra([[match("sf1", "Semifinale 1", null, "d", { done: true, bye: true })]]);
    expect(screen.getByText("Passa il turno")).toBeTruthy();
    expect(inEvidenza(riga("Delta"))).toBe(true);
  });

  it("un match senza «bye» non dice mai «Passa il turno»", () => {
    mostra();
    expect(screen.queryByText("Passa il turno")).toBeNull();
  });
});

describe("Bracket: campione", () => {
  /** La finale giocata tra Alfa e Beta */
  const conFinale = (pA: number, pB: number): BracketMatch[][] => [[match("fin", "Finale", "a", "b", { pA, pB, done: true })]];

  it("la finale giocata ha il segno «Campione», chiunque vinca", () => {
    const { unmount } = mostra(conFinale(21, 18));
    expect(screen.getByText("Campione")).toBeTruthy();
    unmount();
    mostra(conFinale(18, 21));
    expect(screen.getByText("Campione")).toBeTruthy();
  });

  it("la finale ancora da giocare non lo ha", () => {
    mostra([[match("fin", "Finale", "a", "b")]]);
    expect(screen.queryByText("Campione")).toBeNull();
  });

  it("una semifinale giocata non lo ha", () => {
    mostra();
    expect(screen.queryByText("Campione")).toBeNull();
  });
});

describe("Bracket: controlli di inserimento", () => {
  const controlli = (m: BracketMatch) => <button>Gioca {m.label}</button>;

  it("compaiono solo per i match da giocare con tutte e due le squadre note", () => {
    // sf1 è giocata, sf2 è da giocare con tutte e due le squadre, la finale ha ancora un posto vuoto
    mostra(tabellone(), { renderControls: controlli });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Gioca Semifinale 2" })).toBeTruthy();
  });

  it("senza renderControls (sola lettura) non c'è nessun controllo, nemmeno per i match da giocare", () => {
    mostra();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
