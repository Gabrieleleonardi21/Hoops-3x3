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
