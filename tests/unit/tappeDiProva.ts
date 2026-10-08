import { DEFAULT_RULES } from "../../src/constants/rules";
import type { StatLine, StatSheet, Tappa } from "../../src/types";

/** Un tabellino scritto per nome del giocatore (com'è nel roster): la tappa di prova lo converte negli id */
export type TabellinoPerNome = Record<string, StatLine | number>;

/** Una partita di prova tra due squadre, indicate per nome */
export interface GaraDiProva {
  a: string;
  b: string;
  pa?: TabellinoPerNome;
  pb?: TabellinoPerNome;
  /** Se manca la partita è giocata */
  done?: boolean;
  /** Il punteggio non conta per le statistiche dei giocatori: se mancano sono 21 e 15 */
  sa?: number;
  sb?: number;
  /** Quando il risultato è stato registrato (Partita.ts); assente nelle partite di prima che esistesse */
  ts?: number;
}

/** Una tappa di prova. `rose`: nome della squadra → nomi dei suoi giocatori. Gli id nascono da tappa, squadra e nome: come
 *  nell'app, dove si generano a ogni tappa, lo stesso giocatore ha id diversi in tappe diverse */
export function tappaDiProva(id: string, rose: Record<string, string[]>, gare: GaraDiProva[]): Tappa {
  const idSquadra = (squadra: string) => `${id}:${squadra}`;
  const idGiocatore = (squadra: string, nome: string) => `${id}:${squadra}:${nome}`;
  const scheda = (squadra: string, tabellino: TabellinoPerNome = {}): StatSheet =>
    Object.fromEntries(Object.entries(tabellino).map(([nome, stat]) => [idGiocatore(squadra, nome), stat]));

  const squadre = Object.entries(rose).map(([nome, giocatori]) => ({
    id: idSquadra(nome), nome, rank: "", giocatori: giocatori.map((n) => ({ id: idGiocatore(nome, n), nome: n })),
  }));
  const partite = gare.map((g, i) => ({
    id: `${id}:m${i}`, g: 0, a: idSquadra(g.a), b: idSquadra(g.b), sa: g.sa ?? 21, sb: g.sb ?? 15, done: g.done ?? true,
    ts: g.ts, pa: scheda(g.a, g.pa), pb: scheda(g.b, g.pb),
  }));
  return {
    id, nome: `Tappa ${id}`, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
    squadre, gironi: [squadre.map((s) => s.id)], partite, video: [],
  };
}

/** Una tappa in cui `nome`, della squadra `squadra`, gioca una partita contro «Avversari» con queste statistiche */
export function unaGara(id: string, squadra: string, nome: string, stat: StatLine | number): Tappa {
  return tappaDiProva(id, { [squadra]: [nome], Avversari: ["Altro"] }, [{ a: squadra, b: "Avversari", pa: { [nome]: stat } }]);
}
