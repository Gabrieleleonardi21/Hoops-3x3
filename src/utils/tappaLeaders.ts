import type { Tappa } from "../types";
import { STAT_KEYS } from "../constants/rules";
import { tabellini } from "./statGiocatori";

export interface LeaderRow {
  pid: string; nome: string; squadra: string; g: number;
  pt: number; rb: number; as: number; ru: number; st: number; pe: number; fa: number;
}

/** Aggrega le statistiche dei giocatori su tutte le gare giocate della tappa, una riga per id di roster. Quali tabellini
 *  contano e come si leggono lo decide tabellini() (utils/statGiocatori), lo stesso aiuto della tabella di stagione */
export function tappaLeaders(tappa: Tappa): LeaderRow[] {
  const acc: Record<string, LeaderRow> = {};
  tabellini(tappa).forEach(({ pid, nome, squadra, stat }) => {
    if (!nome) return;
    if (!acc[pid]) acc[pid] = { pid, nome, squadra, g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0, pe: 0, fa: 0 };
    acc[pid].g++;
    STAT_KEYS.forEach(([k]) => { acc[pid][k] += stat[k]; });
  });
  return Object.values(acc);
}
