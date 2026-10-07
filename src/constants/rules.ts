import type { Regole } from "../types";

export const DEFAULT_RULES: Regole = { target: 21, durata: 10, ot: 2, shot: 12 };

/** [chiave, intestazione] delle statistiche per giocatore */
export const STAT_KEYS: [keyof import("../types").StatLine, string][] = [
  ["pt", "PT"], ["rb", "RIMB"], ["as", "AST"], ["ru", "RUB"],
  ["st", "STO"], ["pe", "PER"], ["fa", "FALLI"],
];

export const LEADER_CATS: [keyof import("../types").StatLine, string][] = [
  ["pt", "Punti"], ["rb", "Rimbalzi"], ["as", "Assist"], ["ru", "Palle rubate"], ["st", "Stoppate"],
];

/** Giocatori di una squadra in una tappa: almeno 3 per poter sorteggiare, al massimo 4 */
export const MIN_ROSTER = 3;
export const MAX_ROSTER = 4;

/** Squadre di una tappa: da 2 a 64, per l'interfaccia e per il Coach */
export const MIN_SQUADRE = 2;
export const MAX_SQUADRE = 64;

/** Il nome segnaposto della squadra numero `n` (da 1) di una tappa: lo riconosce eSegnaposto in tappaOps */
export function nomeSegnaposto(n: number): string {
  return `Squadra ${n}`;
}
