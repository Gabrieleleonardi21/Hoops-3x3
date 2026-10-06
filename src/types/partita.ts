/** Statistiche individuali di un giocatore in una partita */
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

/** Evento registrato durante una partita (fallo, sostituzione, timeout…) */
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
  /** Quando è stato registrato o corretto il risultato, in millisecondi (Date.now): dà l'ordine di inserimento, che il calendario
   *  non ha («Ultimo risultato» della home). Manca nelle partite registrate prima che esistesse: contano come più vecchie. */
  ts?: number;
  pa?: StatSheet;
  pb?: StatSheet;
  eventi?: EventoGara[];
}
