export interface StatLine {
  pt?: number; // punti
  rb?: number; // rimbalzi
  as?: number; // assist
  ru?: number; // palle rubate
  st?: number; // stoppate
  pe?: number; // palle perse
  fa?: number; // falli
}

/** pid -> statistiche (number = formato legacy: soli punti) */
export type StatSheet = Record<string, StatLine | number>;

export interface EventoGara {
  id: string;
  tipo: string;
  teamId: string;
  pid: string | null;
  min: string;
  nota: string;
}

export interface Partita {
  id: string;
  /** indice del girone */
  g: number;
  /** id squadra A / B */
  a: string;
  b: string;
  sa: number;
  sb: number;
  done: boolean;
  pa?: StatSheet;
  pb?: StatSheet;
  eventi?: EventoGara[];
}
