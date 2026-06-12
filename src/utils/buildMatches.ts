import type { Partita } from "../types";
import { uid } from "./uid";

/** Calendario all'italiana dentro ogni girone (ogni squadra incontra le altre) */
export function buildMatches(gironi: string[][]): Partita[] {
  const ms: Partita[] = [];
  gironi.forEach((g, gi) => {
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        ms.push({ id: uid(), g: gi, a: g[i], b: g[j], sa: 0, sb: 0, done: false });
  });
  return ms;
}
