/** Le pagine riservate a chi è entrato, anche come ospite, in un posto solo (FP-5): in App stanno dentro questa rotta. Senza utente
 *  si torna alla home, che mostra l'accesso. */
import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../../stores/useAppStore";
import type { User } from "../../types";

export function RequireAuth() {
  const user = useAppStore((s) => s.user);
  if (!user) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** L'utente di una pagina dentro RequireAuth, dove c'è sempre: le pagine lo leggono già non nullo. All'uscita la pagina può
 *  ridisegnarsi un'ultima volta prima che RequireAuth la tolga: vale l'utente con cui si è aperta, non un errore. Una pagina che
 *  non ha mai avuto un utente è fuori da RequireAuth: è un errore di programmazione, e lo si dice subito */
export function useUtente(): User {
  const user = useAppStore((s) => s.user);
  const [allApertura] = useState(user);
  const utente = user ?? allApertura;
  if (!utente) throw new Error("useUtente si usa solo nelle pagine dentro RequireAuth");
  return utente;
}
