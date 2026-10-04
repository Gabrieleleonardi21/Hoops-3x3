import type { User } from "../types";

/** true se l'utente può modificare o eliminare una voce: ne è l'autore oppure è ADMIN (come sul server).
 *  Si confronta l'id, non il nome visualizzato: due utenti possono chiamarsi allo stesso modo, e l'ADMIN può su tutto.
 *  L'ospite non può mai: non ha un account, e il server rifiuterebbe comunque la scrittura. */
export function puoModificare(user: User | null, autoreId: string): boolean {
  if (!user || user.guest) return false;
  if (user.ruolo === "ADMIN") return true;
  return user.id === autoreId;
}
