import type { Partita } from "../types";

export interface StandingRow {
  id: string; nome: string; g: number; v: number; p: number; pf: number; ps: number;
}

/** Classifica di un girone: vittorie, poi punti fatti, poi differenza
 *  (criteri FIBA 3x3 semplificati) */
export function standings(
  girone: string[],
  partite: Partita[],
  nameOf: (id: string) => string
): StandingRow[] {
  const rows: StandingRow[] = girone.map((id) => ({ id, nome: nameOf(id), g: 0, v: 0, p: 0, pf: 0, ps: 0 }));
  const find = (id: string) => rows.find((r) => r.id === id);
  partite.filter((m) => m.done).forEach((m) => {
    const A = find(m.a), B = find(m.b);
    if (!A || !B) return;
    const sa = Number(m.sa), sb = Number(m.sb);
    A.g++; B.g++; A.pf += sa; A.ps += sb; B.pf += sb; B.ps += sa;
    if (sa > sb) { A.v++; B.p++; } else { B.v++; A.p++; }
  });
  return rows.sort((x, y) => y.v - x.v || y.pf - x.pf || (y.pf - y.ps) - (x.pf - x.ps));
}
