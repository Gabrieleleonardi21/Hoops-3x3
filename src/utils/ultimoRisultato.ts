import type { Partita } from "../types";

/** L'ultimo risultato registrato tra le partite dei gironi: la giocata con il momento di registrazione (`ts`) più alto, che segue
 *  l'ordine d'inserimento e non quello del calendario. Le partite senza `ts` (registrate prima che esistesse) contano come più
 *  vecchie di quelle con `ts`, e tra loro, come a pari momento, vale l'ordine del calendario: l'ultima. null se nessuna è giocata. */
export function ultimoRisultato(partite: Partita[]): Partita | null {
  let ultima: Partita | null = null;
  for (const m of partite) {
    if (!m.done) continue;
    if (!ultima || (m.ts ?? 0) >= (ultima.ts ?? 0)) ultima = m;
  }
  return ultima;
}
