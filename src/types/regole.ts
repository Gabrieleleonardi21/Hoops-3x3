export interface Regole {
  /** punteggio vittoria (FIBA 3x3: 21) */
  target: number;
  /** durata in minuti (FIBA 3x3: 10) */
  durata: number;
  /** punti per vincere il supplementare (FIBA 3x3: 2) */
  ot: number;
  /** secondi di possesso (FIBA 3x3: 12) */
  shot: number;
}
