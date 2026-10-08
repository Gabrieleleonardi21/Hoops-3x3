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

/** Giocatori di una squadra in una tappa (RosterEditor, Coach): almeno 3 per poter sorteggiare, al massimo 4, quanti ne porta in
 *  campo una squadra 3x3. È un concetto diverso dal roster dell'anagrafe qui sotto */
export const MIN_ROSTER = 3;
export const MAX_ROSTER = 4;

/** Giocatori nel roster di una squadra dell'anagrafe condivisa (SquadraAnagrafeForm): la rosa stagionale da cui si pescano i 4 di
 *  una tappa. Il form dichiara e applica questo limite. Il server (SquadraRequestDTO) ne accetta fino a 12: è un tetto di
 *  compatibilità per i roster già salvati e per altri client, e non si abbassa */
export const MAX_ROSTER_ANAGRAFE = 6;

/** Squadre di una tappa: da 2 a 64, per l'interfaccia e per il Coach */
export const MIN_SQUADRE = 2;
export const MAX_SQUADRE = 64;

/** Limiti del server su una lega (NuovaLegaDTO, PatchLegaDTO): caratteri del nome e tappe per lega. Oltre, 400. Li usano i campi del
 *  nome (maxLength), l'import di una lega da file e la creazione di una tappa */
export const MAX_NOME_LEGA = 120;
export const MAX_TAPPE_LEGA = 100;

/** Il nome segnaposto della squadra numero `n` (da 1) di una tappa: lo riconosce eSegnaposto in tappaOps */
export function nomeSegnaposto(n: number): string {
  return `Squadra ${n}`;
}
