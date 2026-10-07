/** Ciò che l'app tiene nel localStorage: la sessione, la lega aperta per ultima e, per l'ospite, le sue leghe. Funzioni senza stato:
 *  chi le chiama (useAppStore) decide che cosa dire all'utente quando il browser rifiuta una scrittura. */
import type { LegaMeta, Tappa, User } from "../types";
import { leggiLegaSalvata, type LegaSalvata } from "../utils/legaFile";

export const SESSION_KEY = "hoop3x3_session";
const NS = "hoop3x3_";
export const INDEX_KEY  = NS + "leghe_index";   // indice leghe dell'ospite
// ID della lega aperta per ultima: una chiave per l'ospite e una per il registrato. Con una sola, chi passava da una modalità
// all'altra su questo browser trovava l'id dell'altra (un id locale non esiste sul server e viceversa) e lo cancellava.
// Quella dell'ospite è la storica, già nei browser di chi usa l'app senza account.
export const ACTIVE_KEY_OSPITE = NS + "active_lega_id";
export const ACTIVE_KEY_REGISTRATO = NS + "active_lega_id_registrato";

export const legaStorageKey = (id: string) => NS + `lega_${id}`;

export function readIndex(): LegaMeta[] {
  try {
    const indice: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    // Solo le voci con un id: un indice rovinato (non un elenco, voci vuote) non si può mostrare né aprire
    if (Array.isArray(indice)) return indice.filter((m) => typeof m?.id === "string");
  } catch { /* JSON rovinato */ }
  return [];
}

/** Scrive nel localStorage. false se il browser rifiuta (spazio esaurito, archivio disattivato): chi scrive non deve andare in
 *  errore, perché lo stato in memoria resta giusto e le azioni dell'utente vanno comunque a buon fine */
export function scrivi(chiave: string, valore: string): boolean {
  try {
    localStorage.setItem(chiave, valore);
    return true;
  } catch {
    return false;
  }
}

/** Lega dell'ospite dal browser, controllata con lo schema del file di lega (utils/legaFile): solo le tappe valide, e un avviso
 *  se ne ha scartata qualcuna. null se non c'è o non si legge. */
export function readLegaData(id: string): LegaSalvata | null {
  try { return leggiLegaSalvata(JSON.parse(localStorage.getItem(legaStorageKey(id)) || "null")); }
  catch { return null; }
}

/** Perché una lega dell'ospite non si apre, con la via d'uscita: eliminarla dall'elenco */
export function legaIllegibile(leghe: LegaMeta[], id: string): string {
  const nome = leghe.find((m) => m.id === id)?.nome || "senza nome";
  return `I dati della lega «${nome}» non ci sono più nel browser o sono danneggiati: puoi eliminarla dall'elenco delle leghe.`;
}

/** Le leghe dell'ospite e la lega aperta, con l'avviso per la barra sotto l'intestazione (`syncError`) */
export interface StatoOspite {
  leghe: LegaMeta[];
  legaId: string | null;
  legaName: string;
  tappe: Tappa[];
  syncError: string | null;
}

/** Stato dell'ospite letto dal browser: indice delle leghe e lega aperta per ultima. Una lega che non si legge non si apre, e
 *  l'avviso in `syncError` (la barra sotto l'intestazione) dice perché; una con tappe non valide si apre senza quelle, e
 *  l'avviso dice quali. Così all'avvio non ci sono pagine bianche né un errore che torna a ogni ricarica. */
export function statoOspite(): StatoOspite {
  const leghe = readIndex();
  const vuoto: StatoOspite = { leghe, legaId: null, legaName: "", tappe: [], syncError: null };
  const activeId = localStorage.getItem(ACTIVE_KEY_OSPITE);
  if (!activeId) return vuoto;
  const letta = readLegaData(activeId);
  if (letta) return { leghe, legaId: activeId, legaName: letta.lega.nome, tappe: letta.lega.tappe, syncError: letta.avviso };
  // Non si riapre a ogni ricarica; dell'id si dice qualcosa solo se la lega è nell'elenco: se non c'è più (eliminata da un'altra
  // scheda) è un id rimasto, non un problema
  localStorage.removeItem(ACTIVE_KEY_OSPITE);
  if (!leghe.some((m) => m.id === activeId)) return vuoto;
  return { ...vuoto, syncError: legaIllegibile(leghe, activeId) };
}

export function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
