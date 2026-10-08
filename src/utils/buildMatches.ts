import type { Partita } from "../types";
import { uid } from "./uid";

/**
 * Calendario all'italiana dentro ogni girone (ogni squadra incontra le altre), in ordine di
 * giornata con il metodo del cerchio (tabelle di Berger): la prima squadra resta ferma e le altre
 * ruotano di un posto a ogni giornata, così nessuno gioca tutte le partite di fila.
 * Con un numero dispari di squadre si aggiunge un posto vuoto: chi lo incontra riposa.
 */
export function buildMatches(gironi: string[][]): Partita[] {
  const ms: Partita[] = [];
  gironi.forEach((g, gi) => {
    const posti: (string | null)[] = [...g];
    if (posti.length % 2 === 1) posti.push(null);
    const n = posti.length;
    for (let giornata = 0; giornata < n - 1; giornata++) {
      // Accoppia il primo con l'ultimo, il secondo con il penultimo, e così via
      for (let i = 0; i < n / 2; i++) {
        const a = posti[i];
        const b = posti[n - 1 - i];
        if (a !== null && b !== null) ms.push({ id: uid(), g: gi, a, b, sa: 0, sb: 0, done: false });
      }
      // Rotazione: il primo resta fermo, l'ultimo passa in seconda posizione
      posti.splice(1, 0, posti.pop() as string | null);
    }
  });
  return ms;
}
