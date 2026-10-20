/** Squadre e giocatori di una tappa letti per id, in un posto solo (FP-5). Un id che non si trova (dati importati incoerenti, una
 *  squadra eliminata) dà sempre lo stesso ripiego, mai l'id stesso, che per chi legge è un codice senza senso. */
import type { GiocatoreRoster, SquadraTappa, Tappa } from "../types";
import { letteraGirone } from "./formato";

/** Il nome mostrato per una squadra o un giocatore che non si trova, o che non ha nome */
export const SCONOSCIUTO = "?";

/** La squadra con quell'id, se c'è */
export function squadraDi(squadre: readonly SquadraTappa[] | undefined, id: string | null | undefined): SquadraTappa | undefined {
  if (!squadre || !id) return undefined;
  return squadre.find((s) => s.id === id);
}

/** Il nome della squadra da mostrare */
export function nomeSquadra(squadre: readonly SquadraTappa[] | undefined, id: string | null | undefined): string {
  return squadraDi(squadre, id)?.nome || SCONOSCIUTO;
}

/** Il logo della squadra, se ne ha uno */
export function logoSquadra(squadre: readonly SquadraTappa[] | undefined, id: string | null | undefined): string | undefined {
  return squadraDi(squadre, id)?.logo;
}

/** I giocatori della squadra con il nome compilato: sono quelli che contano per il roster e per i tabellini */
export function giocatoriDi(squadre: readonly SquadraTappa[] | undefined, id: string | null | undefined): GiocatoreRoster[] {
  return (squadraDi(squadre, id)?.giocatori ?? []).filter((p) => p.nome.trim());
}

/** Il nome di un giocatore della tappa, cercato in tutte le squadre. Una squadra di dati vecchi o importati può non avere
 *  l'elenco `giocatori`: vale come vuoto */
export function nomeGiocatore(squadre: readonly SquadraTappa[] | undefined, pid: string): string {
  for (const s of squadre ?? []) {
    const p = (s.giocatori ?? []).find((g) => g.id === pid);
    if (p) return p.nome || SCONOSCIUTO;
  }
  return SCONOSCIUTO;
}

/** Il girone di una squadra della tappa, come lettera (A, B…); null se la tappa non è sorteggiata o la squadra non è in un girone */
export function letteraGironeDi(tappa: Pick<Tappa, "gironi">, id: string): string | null {
  const indice = tappa.gironi?.findIndex((g) => g.includes(id)) ?? -1;
  if (indice < 0) return null;
  return letteraGirone(indice);
}

/** Dove sta una squadra nella tappa, per distinguerla da un'omonima: «girone B», o «non sorteggiata» */
export function postoSquadra(tappa: Pick<Tappa, "gironi">, id: string): string {
  const lettera = letteraGironeDi(tappa, id);
  if (lettera === null) return "non sorteggiata";
  return `girone ${lettera}`;
}
