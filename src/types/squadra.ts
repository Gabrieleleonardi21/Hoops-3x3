import type { GiocatoreRoster } from "./giocatore";

/** Squadra iscritta a una tappa */
export interface SquadraTappa {
  id: string;
  nome: string;
  giocatori: GiocatoreRoster[];
  /** punti ranking del circuito (per il sorteggio per ranking) */
  rank: string | number;
  /** ID della RegSquadra nell'anagrafe condivisa (se collegata) */
  regId?: string;
  /** URL o path del logo squadra (opzionale) */
  logo?: string;
  /** URL sito web ufficiale della squadra (opzionale) */
  website?: string;
  /** URL profilo Instagram della squadra (opzionale) */
  instagram?: string;
}
