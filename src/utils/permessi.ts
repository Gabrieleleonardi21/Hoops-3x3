import type { User } from "../types";

/** true se l'utente può modificare o eliminare una voce: ne è l'autore oppure è ADMIN (come sul server).
 *  Si confronta l'id, non il nome visualizzato: due utenti possono chiamarsi allo stesso modo, e l'ADMIN può su tutto.
 *  L'ospite non può mai: non ha un account, e il server rifiuterebbe comunque la scrittura.
 *  `autoreId` null = voce della forma pubblica dell'anagrafe (letta senza account), con i dati personali nascosti: nessuno la
 *  modifica da lì, nemmeno l'ADMIN, perché il form partirebbe da campi vuoti e il salvataggio li scriverebbe sul server. */
export function puoModificare(user: User | null, autoreId: string | null): boolean {
  if (!user || user.guest || autoreId === null) return false;
  if (user.ruolo === "ADMIN") return true;
  // Una sessione salvata da una versione precedente non ha l'id: senza id non si è autore di niente (e due id mancanti,
  // undefined === undefined, darebbero «autore» su una voce arrivata senza autoreId)
  if (!user.id) return false;
  return user.id === autoreId;
}
