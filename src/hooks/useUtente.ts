/** L'utente di una pagina dentro RequireAuth (components/auth), dove c'è sempre: le pagine lo leggono già non nullo. Sta in un file
 *  suo perché un file di componenti che esporta anche un hook non si aggiorna a caldo (react-refresh). */
import { useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import type { User } from "../types";

/** Se l'utente se ne va mentre la pagina è ancora montata (un'uscita che la pagina vede prima di essere tolta; nei test, lo store
 *  azzerato con la pagina ancora aperta: senza il ripiego anagrafe.test chiude con un errore non gestito) vale l'utente con cui la
 *  pagina si è aperta, non un errore. Una pagina che non ha mai avuto un utente è fuori da RequireAuth: è un errore di
 *  programmazione, e lo si dice subito */
export function useUtente(): User {
  const user = useAppStore((s) => s.user);
  const [allApertura] = useState(user);
  const utente = user ?? allApertura;
  if (!utente) throw new Error("useUtente si usa solo nelle pagine dentro RequireAuth");
  return utente;
}
