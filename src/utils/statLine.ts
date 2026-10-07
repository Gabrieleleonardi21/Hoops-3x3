import type { StatLine } from "../types";

/** Il tabellino di un giocatore in una partita come StatLine, in un posto solo (FP-5). Il formato vecchio è un numero, i soli
 *  punti; un tabellino mancante (o nullo, da un file importato) è vuoto. */
export function toStatLine(raw: StatLine | number | null | undefined): StatLine {
  if (typeof raw === "number") return { pt: raw };
  if (raw && typeof raw === "object") return raw;
  return {};
}
