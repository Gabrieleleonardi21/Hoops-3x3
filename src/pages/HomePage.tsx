/** Pagina iniziale: mostra il form di autenticazione se l'utente non è loggato,
 *  altrimenti reindirizza alla lega attiva (se esiste) o alla lista delle leghe. */
import { Navigate } from "react-router-dom";
import { AuthForm } from "../components/auth/AuthForm";
import { useAppStore } from "../stores/useAppStore";

export function HomePage() {
  const user   = useAppStore((s) => s.user);
  const legaId = useAppStore((s) => s.legaId);
  if (user) return <Navigate to={legaId ? "/lega" : "/leghe"} replace />;
  return <AuthForm />;
}
