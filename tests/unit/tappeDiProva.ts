import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Partita, StatLine, StatSheet, Tappa } from "../../src/types";

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
  const partite = gare.map((g, i) => {
    const partita: Partita = {
      id: `${id}:m${i}`, g: 0, a: idSquadra(g.a), b: idSquadra(g.b), sa: g.sa ?? 21, sb: g.sb ?? 15, done: g.done ?? true,
      pa: scheda(g.a, g.pa), pb: scheda(g.b, g.pb),
    };
    // Solo se c'è: una chiave `ts: undefined` sparirebbe nel JSON mandato al server e i confronti sui corpi non tornerebbero
    if (g.ts !== undefined) partita.ts = g.ts;
    return partita;
  });
  return {
    id, nome: `Tappa ${id}`, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
    squadre, gironi: [squadre.map((s) => s.id)], partite, video: [],
  };
}

/** Un giocatore di prova: il nome, e l'id dell'anagrafe se viene da lì. Una stringa è un giocatore senza regId */
export type GiocatoreDiProva = string | { nome: string; regId?: string };

/** Una squadra di prova: il nome, il regId dell'anagrafe se è collegata, i giocatori del roster */
export interface SquadraDiProva {
  nome: string;
  regId?: string;
  giocatori: GiocatoreDiProva[];
}

/** Una partita di prova per indici: `a` e `b` sono gli indici delle squadre, `pa` e `pb` i tabellini per indice del giocatore
 *  nella squadra. Serve con `tappaDaSquadre`, che sa rappresentare anche due squadre o due giocatori con lo stesso nome */
export interface GaraPerIndice {
  a: number;
  b: number;
  pa?: Record<number, StatLine | number>;
  pb?: Record<number, StatLine | number>;
  done?: boolean;
  sa?: number;
  sb?: number;
  ts?: number;
}

/** Una tappa di prova con squadre e giocatori indicati per indice (non per nome), quindi anche con omonimi. Gli id nascono da
 *  tappa, indice della squadra e indice del giocatore: `${id}:s0`, `${id}:s0:p1`, e così le partite `${id}:m0`. Un girone con
 *  tutte le squadre */
export function tappaDaSquadre(id: string, squadre: SquadraDiProva[], gare: GaraPerIndice[]): Tappa {
  const idSquadra = (i: number) => `${id}:s${i}`;
  const idGiocatore = (i: number, j: number) => `${id}:s${i}:p${j}`;
  const scheda = (i: number, tabellino: Record<number, StatLine | number> = {}): StatSheet =>
    Object.fromEntries(Object.entries(tabellino).map(([j, stat]) => [idGiocatore(i, Number(j)), stat]));

  const squadreTappa = squadre.map((s, i) => ({
    id: idSquadra(i),
    nome: s.nome,
    rank: "",
    regId: s.regId,
    giocatori: s.giocatori.map((g, j) => {
      const { nome, regId } = typeof g === "string" ? { nome: g, regId: undefined } : g;
      return { id: idGiocatore(i, j), nome, regId };
    }),
  }));
  const partite = gare.map((g, k): Partita => ({
    id: `${id}:m${k}`, g: 0, a: idSquadra(g.a), b: idSquadra(g.b), sa: g.sa ?? 21, sb: g.sb ?? 15, done: g.done ?? true,
    pa: scheda(g.a, g.pa), pb: scheda(g.b, g.pb), ...(g.ts !== undefined && { ts: g.ts }),
  }));
  return {
    id, nome: `Tappa ${id}`, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
    squadre: squadreTappa, gironi: [squadreTappa.map((s) => s.id)], partite, video: [],
  };
}

/** Una tappa in cui `nome`, della squadra `squadra`, gioca una partita contro «Avversari» con queste statistiche */
export function unaGara(id: string, squadra: string, nome: string, stat: StatLine | number): Tappa {
  return tappaDiProva(id, { [squadra]: [nome], Avversari: ["Altro"] }, [{ a: squadra, b: "Avversari", pa: { [nome]: stat } }]);
}
