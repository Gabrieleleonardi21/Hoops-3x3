import type { Partita } from "../types";

export interface StandingRow {
  id: string; nome: string; g: number; v: number; p: number; pf: number; ps: number;
}

/** Le partite che contano in una classifica: giocate e con un vincitore. Una segnata come giocata ma in parità
 *  (tappaOps rifiuta i pareggi, ma un file di lega importato può averla: legaFile non la controlla) non conta
 *  per niente, nemmeno come partita giocata. La usano la classifica del girone e quella del circuito, così la
 *  regola sta in un solo punto */
export function giocateConVincitore(partite: Partita[]): Partita[] {
  return partite.filter((m) => m.done && Number(m.sa) !== Number(m.sb));
}

/** Id della squadra che ha vinto una partita di giocateConVincitore */
export function vincitore(m: Partita): string {
  if (Number(m.sa) > Number(m.sb)) return m.a;
  return m.b;
}

/** Divide le righe in fasce di pari valore di `chiave`, dalla più alta alla più bassa. Il sort è stabile:
 *  dentro una fascia le righe restano nell'ordine d'ingresso (quello del girone) */
function fasce(righe: StandingRow[], chiave: (r: StandingRow) => number): StandingRow[][] {
  const out: StandingRow[][] = [];
  [...righe].sort((x, y) => chiave(y) - chiave(x)).forEach((r) => {
    const ultima = out[out.length - 1];
    if (ultima && chiave(ultima[0]) === chiave(r)) {
      ultima.push(r);
    } else {
      out.push([r]);
    }
  });
  return out;
}

/** Media dei punti fatti per gara giocata; 0 senza gare */
function mediaPunti(r: StandingRow): number {
  if (r.g === 0) return 0;
  return r.pf / r.g;
}

/** Ordina le squadre a pari vittorie come l'articolo 13 («Classification») delle FIBA 3x3 Official Rules of the Game, lo stesso
 *  ordine del formato di gara del FIBA 3x3 World Cup 2019 (fiba.basketball/3x3wc/2019/competition-format): i criteri si applicano
 *  nell'ordine, ciascuno una volta sola, e chi resta a pari dopo uno passa al successivo.
 *  1. Scontri diretti («head-to-head confrontation, only taking win/loss into account»), calcolati una volta su tutto il gruppo: le
 *     vittorie nelle sole partite giocate tra le squadre del gruppo (contano vittorie e sconfitte, non i punti). Non si rifanno tra
 *     le squadre rimaste a pari.
 *  2. Media dei punti fatti per gara giocata in tutto il girone («most points scored in average»): non il totale, che a metà girone
 *     premierebbe chi ha giocato di più, e non la differenza punti, che il regolamento non prevede.
 *  3. A parità completa decide la testa di serie («the one(s) with the highest seeding»): qui l'ordine d'ingresso (il sort è stabile),
 *     che con il sorteggio per ranking è quello delle teste di serie. */
function risolviParita(gruppo: StandingRow[], giocate: Partita[]): StandingRow[] {
  const ids = new Set(gruppo.map((r) => r.id));
  const tra = giocate.filter((m) => ids.has(m.a) && ids.has(m.b));
  return fasce(gruppo, (r) => tra.filter((m) => vincitore(m) === r.id).length)
    .flatMap((livello) => [...livello].sort((x, y) => mediaPunti(y) - mediaPunti(x)));
}

/** Classifica di un girone: vittorie; a pari vittorie gli scontri diretti, una volta sola; poi la media dei punti fatti, poi
 *  l'ordine d'ingresso (regolamento FIBA 3x3, art. 13: vedi risolviParita). Tutte le classifiche di girone dell'app (tabella, home,
 *  archivio, tabellone, Coach AI) passano da qui: il criterio sta in questo solo punto */
export function standings(
  girone: string[],
  partite: Partita[],
  nameOf: (id: string) => string
): StandingRow[] {
  const rows: StandingRow[] = girone.map((id) => ({ id, nome: nameOf(id), g: 0, v: 0, p: 0, pf: 0, ps: 0 }));
  const find = (id: string) => rows.find((r) => r.id === id);
  // Una partita in parità non conta nemmeno come gara giocata (vedi giocateConVincitore): così G resta V + P e le
  // medie del tabellone (punti e vittorie per gara, buildBracket) non si falsano
  const giocate = giocateConVincitore(partite);
  giocate.forEach((m) => {
    const A = find(m.a), B = find(m.b);
    if (!A || !B) return;
    const sa = Number(m.sa), sb = Number(m.sb);
    A.g++; B.g++; A.pf += sa; A.ps += sb; B.pf += sb; B.ps += sa;
    // chi vince lo decide solo vincitore(), come negli scontri diretti: i punteggi qui servono solo ai punti
    if (vincitore(m) === m.a) { A.v++; B.p++; } else { B.v++; A.p++; }
  });
  // Prima le vittorie; ogni gruppo a pari vittorie si ordina con gli scontri diretti
  return fasce(rows, (r) => r.v).flatMap((gruppo) => risolviParita(gruppo, giocate));
}
