import type { Regole } from "./regole";
import type { SquadraTappa } from "./squadra";
import type { Partita } from "./partita";

export interface VideoItem {
  id: string;
  titolo: string;
  url: string;
}

/** Singola sfida nella fase a eliminazione diretta */
export interface BracketMatch {
  id: string;
  label: string;            // "SF 1", "SF 2", "Finale"
  squadraA: string | null;  // id squadra, null = da determinare
  squadraB: string | null;
  pA: number;
  pB: number;
  done: boolean;
}

export interface Tappa {
  id: string;
  nome: string;
  luogo: string;
  data: string;
  nGironi: number;
  regole: Regole;
  squadre: SquadraTappa[];
  /** array di gironi, ciascuno array di id squadra; null = non sorteggiati */
  gironi: string[][] | null;
  partite: Partita[];
  video: VideoItem[];
  conclusa?: boolean;
  /** Fase a eliminazione diretta, generata dopo i gironi */
  bracket?: BracketMatch[];
}

export interface Lega {
  nome: string;
  tappe: Tappa[];
}

/** Metadati di una lega salvati nell'indice (senza caricare tutte le tappe) */
export interface LegaMeta {
  id: string;
  nome: string;
  ts: number;      // timestamp ultima modifica
  nTappe: number;  // numero tappe (denormalizzato per la visualizzazione nella lista)
}
