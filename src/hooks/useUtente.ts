/** L'utente di una pagina dentro RequireAuth (components/auth), dove c'è sempre: le pagine lo leggono già non nullo. Sta in un file
 *  suo perché un file di componenti che esporta anche un hook non si aggiorna a caldo (react-refresh). */
import { useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import type { User } from "../types";

/** All'uscita la pagina può ridisegnarsi un'ultima volta prima che RequireAuth la tolga: vale l'utente con cui si è aperta, non un
 *  errore. Una pagina che non ha mai avuto un utente è fuori da RequireAuth: è un errore di programmazione, e lo si dice subito */
export function useUtente(): User {
  const user = useAppStore((s) => s.user);
  const [allApertura] = useState(user);
  const utente = user ?? allApertura;
  if (!utente) throw new Error("useUtente si usa solo nelle pagine dentro RequireAuth");
  return utente;
}
