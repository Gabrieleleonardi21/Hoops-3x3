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
  /** Turno superato d'ufficio: c'è una sola squadra, che passa al turno dopo senza giocare (match già `done`).
   *  Assente nei tabelloni salvati prima di questo campo. */
  bye?: boolean;
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
  /** Fase a eliminazione diretta, generata dopo i gironi. Assente quando non c'è; il server la manda come null (colonna JSONB
   *  vuota), e una tappa letta dal server la porta così: chi la legge usa `?.` o `?? []` */
  bracket?: BracketMatch[] | null;
  /** Numero di versione della tappa sul server (T2.7): lo decide il server, che lo fa salire quando un salvataggio la cambia, e
   *  la PUT lo rimanda per dire su quale versione si basano le modifiche (409 se nel frattempo un altro dispositivo ha salvato).
   *  È uno stato del server: manca per l'ospite, per una tappa non ancora creata e nel file della lega (export e import). */
  versione?: number;
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
