/** Come sta una partita di 3x3 secondo le regole della tappa (FIBA 3x3): una funzione pura, senza orologio.
 *  Chi la usa le dà il punteggio, i secondi che restano e, se il supplementare è partito, il punteggio da cui è partito:
 *  il tempo si misura altrove (MatchTimer) e qui arriva già calcolato, così lo stesso risultato si ottiene sempre con gli stessi dati.
 *  - la partita finisce quando una squadra arriva al punteggio di vittoria (`target`);
 *  - a tempo scaduto vince chi è avanti;
 *  - in parità si gioca il supplementare, senza cronometro di gara: vince chi per primo fa `ot` punti da quando è partito. */
import type { Regole } from "../types";

/** Le due squadre: stesse chiavi dei punti */
export type Lato = "a" | "b";

export interface Punti { a: number; b: number }

export interface SituazioneGara {
  /** Punti di adesso, supplementare compreso */
  punti: Punti;
  /** Secondi che restano sul cronometro di gara; 0 (o meno) è tempo scaduto. Nel supplementare il cronometro non c'è e non conta */
  rimasto: number;
  /** Punteggio nel momento in cui è partito il supplementare. Assente: non è ancora partito, e se il tempo è scaduto in parità
   *  parte adesso, dal punteggio di adesso (0 a 0 nel supplementare) */
  inizioSupplementare?: Punti | null;
}

/** I cinque stati della partita: i tre «vinta» hanno un vincitore, gli altri due no */
export type StatoGara =
  | { fase: "inCorso" }
  | { fase: "supplementare" }
  | { fase: "vintaAlPunteggio" | "vintaATempo" | "vintaAlSupplementare"; vincitore: Lato };

/** Chi sta davanti; null in parità */
function inVantaggio(p: Punti): Lato | null {
  if (p.a > p.b) return "a";
  if (p.b > p.a) return "b";
  return null;
}

/** Chi ha raggiunto il traguardo ed è davanti. Una parità non vince mai, nemmeno oltre il traguardo */
function haRaggiunto(p: Punti, traguardo: number): Lato | null {
  const avanti = inVantaggio(p);
  if (avanti && p[avanti] >= traguardo) return avanti;
  return null;
}

export function statoGara(
  { punti, rimasto, inizioSupplementare }: SituazioneGara,
  regole: Pick<Regole, "target" | "ot">,
): StatoGara {
  // Supplementare partito: contano solo i punti fatti da allora. Né il cronometro di gara né il punteggio di vittoria valgono più
  if (inizioSupplementare) {
    const dalLoro = { a: punti.a - inizioSupplementare.a, b: punti.b - inizioSupplementare.b };
    const vincitore = haRaggiunto(dalLoro, regole.ot);
    if (vincitore) return { fase: "vintaAlSupplementare", vincitore };
    return { fase: "supplementare" };
  }
  // Il punteggio di vittoria chiude la partita subito, anche se arriva nello stesso istante in cui scade il tempo
  const alPunteggio = haRaggiunto(punti, regole.target);
  if (alPunteggio) return { fase: "vintaAlPunteggio", vincitore: alPunteggio };
  if (rimasto > 0) return { fase: "inCorso" };
  // Tempo scaduto: vince chi è avanti, in parità si va al supplementare
  const avanti = inVantaggio(punti);
  if (avanti) return { fase: "vintaATempo", vincitore: avanti };
  return { fase: "supplementare" };
}
