/** Pagina iniziale: mostra il form di autenticazione se l'utente non è loggato,
 *  altrimenti lo reindirizza direttamente alla sua lega. */
import { Navigate } from "react-router-dom";
import { AuthForm } from "../components/auth/AuthForm";
import { useAppStore } from "../stores/useAppStore";

export function HomePage() {
  const user = useAppStore((s) => s.user);
  if (user) return <Navigate to="/lega" replace />;
  return <AuthForm />;
}
