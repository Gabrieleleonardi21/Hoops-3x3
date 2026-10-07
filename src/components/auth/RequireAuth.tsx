/** Le pagine riservate a chi è entrato, anche come ospite, in un posto solo (FP-5): in App stanno dentro questa rotta. Senza utente
 *  si torna alla home, che mostra l'accesso. Le pagine leggono il loro utente con useUtente (hooks/useUtente). */
import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../../stores/useAppStore";

export function RequireAuth() {
  const user = useAppStore((s) => s.user);
  if (!user) return <Navigate to="/" replace />;
  return <Outlet />;
}
