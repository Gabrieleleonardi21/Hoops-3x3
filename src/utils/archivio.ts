/** Aiuti per l'elenco dell'archivio: le tappe pubblicate raggruppate per lega. */
import type { PubTappaMeta } from "../types";

export interface GruppoLega {
  chiave: string;   // legaId, o il nome della lega per le voci senza id (server di prima della fase 12)
  lega: string;     // titolo del gruppo
  voci: PubTappaMeta[];
}

/** Le pubblicazioni raggruppate per lega. L'ordine dei gruppi è quello della prima voce di ciascuno nell'elenco del server (le più
 *  recenti prima); dentro il gruppo resta l'ordine del server. Il titolo è il nome della lega della voce più recente: una lega
 *  rinominata porta il nome di adesso. Una Map tiene l'ordine di prima comparsa, quindi nessun riordino qui. */
export function raggruppaPerLega(voci: PubTappaMeta[]): GruppoLega[] {
  const gruppi = new Map<string, GruppoLega>();
  for (const voce of voci) {
    // `??`: un legaId null (pubblicazione senza tappa) ricade sul nome, come una voce del server di prima
    const chiave = voce.legaId ?? voce.lega;
    const gruppo = gruppi.get(chiave);
    if (gruppo) {
      gruppo.voci.push(voce);
    } else {
      gruppi.set(chiave, { chiave, lega: voce.lega, voci: [voce] });
    }
  }
  return [...gruppi.values()];
}
