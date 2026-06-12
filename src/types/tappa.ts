import type { Regole } from "./regole";
import type { SquadraTappa } from "./squadra";
import type { Partita } from "./partita";

export interface VideoItem {
  id: string;
  titolo: string;
  url: string;
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
}

export interface Lega {
  nome: string;
  tappe: Tappa[];
}
