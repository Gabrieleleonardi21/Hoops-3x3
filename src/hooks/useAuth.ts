/** Hook di autenticazione: login, registrazione (backend + JWT) e modalità ospite (solo browser).
 *  L'utente della sessione è persistito in localStorage così il reload non obbliga a rifare il login;
 *  il token JWT lo gestisce services/api.ts. */
import { useAppStore, SESSION_KEY } from "../stores/useAppStore";
import * as authService from "../services/authService";
import type { User } from "../types";

/** Salva l'utente della sessione nel browser (anche App.tsx, quando all'avvio il server restituisce quello aggiornato) */
export function saveSession(u: User) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch { /* quota exceeded */ }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const { user, setUser, reset, rehydrate, salvaTutto } = useAppStore();

  /** Registrazione: il server risponde già con il token, poi si caricano le leghe (vuote) */
  const register = async (name: string, email: string, pass: string) => {
    const u = await authService.register(name, email, pass);
    setUser(u);
    saveSession(u);
    await rehydrate();
  };

  /** Login: lancia ApiError (401 credenziali, 0 server spento) che il form mostra all'utente */
  const login = async (email: string, pass: string) => {
    const u = await authService.login(email, pass);
    setUser(u);
    saveSession(u);
    await rehydrate();
  };

  const enterGuest = async () => {
    const u: User = { name: "Ospite", guest: true };
    setUser(u);
    saveSession(u);
    await rehydrate(); // ripristina eventuale lega ospite precedente
  };

  /** Uscita. Primo passo: salvare le modifiche ancora in attesa, finché il token c'è. Se qualcuna non arriva
   *  al server decide `conferma`, passata dall'interfaccia (il pulsante «Esci» mostra la finestra di conferma):
   *  false = l'utente resta. Senza `conferma` si esce comunque: è il caso della sessione già finita, quando
   *  salvare non è più possibile. Poi lo stato locale, così l'interfaccia non aspetta la rete, e la revoca sul server.
   *  @returns `uscito` false se l'utente ha scelto di restare; `nonSalvate` = tappe con modifiche che non sono
   *  arrivate al server (perse, se si è usciti) */
  const logout = async (
    conferma?: (nonSalvate: number) => Promise<boolean>,
  ): Promise<{ uscito: boolean; nonSalvate: number }> => {
    const nonSalvate = await salvaTutto();
    if (nonSalvate > 0 && conferma) {
      const esci = await conferma(nonSalvate);
      if (!esci) return { uscito: false, nonSalvate };
    }
    clearSession();
    reset();
    await authService.logout();
    return { uscito: true, nonSalvate };
  };

  return { user, register, login, enterGuest, logout };
}
