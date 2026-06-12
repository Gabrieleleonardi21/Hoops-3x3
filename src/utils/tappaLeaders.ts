import type { StatLine, Tappa } from "../types";
import { STAT_KEYS } from "../constants/rules";

export interface LeaderRow {
  nome: string; squadra: string; g: number;
  pt: number; rb: number; as: number; ru: number; st: number; pe: number; fa: number;
}

/** Aggrega le statistiche dei giocatori su tutte le gare giocate della tappa */
export function tappaLeaders(tappa: Tappa): LeaderRow[] {
  const teamOf: Record<string, { nome: string; squadra: string }> = {};
  tappa.squadre.forEach((s) =>
    (s.giocatori || []).forEach((p) => { teamOf[p.id] = { nome: p.nome, squadra: s.nome }; })
  );
  const acc: Record<string, LeaderRow> = {};
  tappa.partite.filter((m) => m.done).forEach((m) => {
    [m.pa, m.pb].forEach((sheet) => {
      Object.entries(sheet || {}).forEach(([pid, raw]) => {
        const stats: StatLine = typeof raw === "object" && raw !== null ? raw : { pt: raw as number };
        const info = teamOf[pid];
        if (!info || !info.nome) return;
        if (!acc[pid]) acc[pid] = { ...info, g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0, pe: 0, fa: 0 };
        acc[pid].g++;
        STAT_KEYS.forEach(([k]) => { acc[pid][k] += Number(stats[k]) || 0; });
      });
    });
  });
  return Object.values(acc);
}
