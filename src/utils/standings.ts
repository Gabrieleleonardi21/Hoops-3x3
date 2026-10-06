import type { Partita } from "../types";

export interface StandingRow {
  id: string; nome: string; g: number; v: number; p: number; pf: number; ps: number;
}

/** Id della squadra che ha vinto una partita giocata (in parità, come nel conteggio delle vittorie, la seconda) */
function vincitore(m: Partita): string {
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

/** Ordina le squadre a pari vittorie con gli scontri diretti: una mini-classifica che conta solo le vittorie
 *  nelle partite giocate tra loro. Se separa solo in parte, la si ricalcola solo tra le squadre rimaste a pari,
 *  finché il gruppo si riduce. Se non separa nessuno (es. tre squadre in cerchio) decidono i punti fatti, poi la
 *  differenza punti e, a parità completa, l'ordine d'ingresso */
function risolviParita(gruppo: StandingRow[], giocate: Partita[]): StandingRow[] {
  if (gruppo.length < 2) return gruppo;
  const ids = new Set(gruppo.map((r) => r.id));
  const tra = giocate.filter((m) => ids.has(m.a) && ids.has(m.b));
  const livelli = fasce(gruppo, (r) => tra.filter((m) => vincitore(m) === r.id).length);
  if (livelli.length === 1) {
    return [...gruppo].sort((x, y) => (y.pf - x.pf) || ((y.pf - y.ps) - (x.pf - x.ps)));
  }
  return livelli.flatMap((livello) => risolviParita(livello, giocate));
}

/** Classifica di un girone: vittorie; a pari vittorie gli scontri diretti; poi punti fatti e differenza punti
 *  (criteri FIBA 3x3 semplificati). Tutte le classifiche dell'app (tabella, tabellone, Coach AI, archivio)
 *  passano da qui: il criterio sta in questo solo punto */
export function standings(
  girone: string[],
  partite: Partita[],
  nameOf: (id: string) => string
): StandingRow[] {
  const rows: StandingRow[] = girone.map((id) => ({ id, nome: nameOf(id), g: 0, v: 0, p: 0, pf: 0, ps: 0 }));
  const find = (id: string) => rows.find((r) => r.id === id);
  const giocate = partite.filter((m) => m.done);
  giocate.forEach((m) => {
    const A = find(m.a), B = find(m.b);
    if (!A || !B) return;
    const sa = Number(m.sa), sb = Number(m.sb);
    A.g++; B.g++; A.pf += sa; A.ps += sb; B.pf += sb; B.ps += sa;
    if (sa > sb) { A.v++; B.p++; } else { B.v++; A.p++; }
  });
  // Prima le vittorie; ogni gruppo a pari vittorie si ordina con gli scontri diretti
  return fasce(rows, (r) => r.v).flatMap((gruppo) => risolviParita(gruppo, giocate));
}
