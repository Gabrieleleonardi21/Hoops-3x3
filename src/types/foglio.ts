/** La bozza di una tappa letta dalla foto di un foglio scritto a mano (POST /api/coach/foglio, BozzaFoglioDTO del server).
 *  I nomi sono quelli letti, non ancora id: diventano una tappa in utils/foglioTappa. Dove il lettore non è sicuro il campo è
 *  null (o il punteggio), e `dubbi` dice perché. */
export interface SquadraLetta {
  nome: string;
  giocatori: string[];
}

export interface PartitaLetta {
  /** Nomi delle due squadre come scritti sul foglio */
  a: string;
  b: string;
  puntiA: number | null;
  puntiB: number | null;
}

export interface BozzaFoglio {
  nome: string | null;
  luogo: string | null;
  /** aaaa-mm-gg, o null se non letta */
  data: string | null;
  squadre: SquadraLetta[];
  /** Nomi delle squadre per girone; null se il foglio non li ha o non si leggono */
  gironi: string[][] | null;
  partite: PartitaLetta[];
  dubbi: string[];
}
