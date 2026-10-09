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
/** La card di un match, dall'etichetta con cui comincia il suo nome accessibile («Semifinale 1: Alfa contro Delta») */
const card = (etichetta: string) => screen.getByRole("group", { name: new RegExp(`^${etichetta}:`) });
/** La riga di chi ha vinto (o di chi passa il turno) lo dice anche ai lettori di schermo, non solo con il colore */
const vince = (rigaSquadra: HTMLElement) => within(rigaSquadra).queryByText("vince") !== null;

describe("Bracket: colonne e nomi", () => {
  it("una colonna per round, con il titolo senza il numero del match", () => {
    mostra();
    expect(screen.getByText("Semifinale")).toBeTruthy(); // «Semifinale 1» e «Semifinale 2» sono le etichette dei match
    expect(screen.getAllByText("Finale")).toHaveLength(2); // titolo della colonna e etichetta del match
    expect(screen.getByText("Semifinale 1")).toBeTruthy();
    expect(screen.getByText("Semifinale 2")).toBeTruthy();
  });

  it("ogni card del match è un gruppo con il nome del turno e delle due squadre", () => {
    mostra();
    expect(screen.getByRole("group", { name: "Semifinale 1: Alfa contro Delta" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Semifinale 2: Beta contro Gamma" })).toBeTruthy();
    expect(screen.getAllByRole("group")).toHaveLength(3);
  });

  it("un posto ancora vuoto si chiama TBD sullo schermo e «posto da assegnare» nel nome della card", () => {
    mostra();
    expect(screen.getByText("TBD")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Finale: Alfa contro posto da assegnare" })).toBeTruthy();
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
  it("la riga di chi ha vinto dice «vince», quella di chi ha perso no", () => {
    mostra();
    const sf1 = within(card("Semifinale 1"));
    expect(vince(sf1.getByText("Alfa").parentElement as HTMLElement)).toBe(true);
    expect(vince(sf1.getByText("Delta").parentElement as HTMLElement)).toBe(false);
  });

  it("vale anche quando vince la squadra B", () => {
    mostra([[match("sf1", "Semifinale 1", "a", "d", { pA: 9, pB: 21, done: true })]]);
    expect(vince(riga("Delta"))).toBe(true);
    expect(vince(riga("Alfa"))).toBe(false);
  });

  it("un match da giocare non ha vincitore né perdente e al posto dei punti c'è un trattino", () => {
    mostra();
    const sf2 = within(card("Semifinale 2"));
    expect(sf2.getAllByText("–")).toHaveLength(2);
    expect(vince(riga("Beta"))).toBe(false);
    expect(vince(riga("Gamma"))).toBe(false);
  });

  /* L'unico test legato alle classi di stile, come documentazione del design system: chi vince si distingue anche dal testo «vince»
   * (sopra), qui si fissa solo come lo si vede. Se i token cambiano si cambia questo test e nessun altro */
  it("stile: la riga di chi vince ha lo sfondo in evidenza, la spunta e il punteggio nel colore dell'accento; chi ha perso e i posti vuoti sono attenuati", () => {
    mostra();
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
    expect(screen.getByText("TBD").classList.contains("text-chalk-dim")).toBe(true);
    expect(screen.getByText("Beta").classList.contains("text-chalk-dim")).toBe(false);
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

  it("la squadra presente passa il turno: la card lo dice nel nome, «Passa il turno» al posto dell'avversaria, nessun punteggio", () => {
    mostra(conBye());
    const sf1 = within(screen.getByRole("group", { name: "Semifinale 1: Alfa passa il turno" }));
    expect(sf1.getByText("Passa il turno")).toBeTruthy();
    expect(vince(sf1.getByText("Alfa").parentElement as HTMLElement)).toBe(true);
    expect(sf1.queryByText("TBD")).toBeNull(); // il posto vuoto non è un «da determinare»: la squadra non ha avversaria
    expect(sf1.getAllByText("–")).toHaveLength(1); // solo il punteggio di Alfa, che non c'è
  });

  it("se l'unica squadra è la B passa lo stesso il turno", () => {
    mostra([[match("sf1", "Semifinale 1", null, "d", { done: true, bye: true })]]);
    expect(screen.getByRole("group", { name: "Semifinale 1: Delta passa il turno" })).toBeTruthy();
    expect(screen.getByText("Passa il turno")).toBeTruthy();
    expect(vince(riga("Delta"))).toBe(true);
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

  it("compaiono per i match con tutte e due le squadre note, giocati («Correggi») o da giocare", () => {
    // sf1 è giocata, sf2 è da giocare con tutte e due le squadre, la finale ha ancora un posto vuoto
    mostra(tabellone(), { renderControls: controlli });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Gioca Semifinale 1", "Gioca Semifinale 2"]);
  });

  it("un turno superato d'ufficio (bye) non ha controlli: non c'è un risultato da correggere", () => {
    mostra([[match("sf1", "Semifinale 1", "a", null, { done: true, bye: true }), match("sf2", "Semifinale 2", "b", "c")],
      [match("fin", "Finale", "a", null)]], { renderControls: controlli });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Gioca Semifinale 2"]);
  });

  it("senza renderControls (sola lettura) non c'è nessun controllo, nemmeno per i match da giocare", () => {
    mostra();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
