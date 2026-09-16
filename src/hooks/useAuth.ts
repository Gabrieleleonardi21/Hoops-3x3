/** Hook di autenticazione: login, registrazione (backend + JWT) e modalità ospite (solo browser).
 *  L'utente della sessione è persistito in localStorage così il reload non obbliga a rifare il login;
 *  il token JWT lo gestisce services/api.ts. */
import { useAppStore, SESSION_KEY } from "../stores/useAppStore";
import * as authService from "../services/authService";
import type { User } from "../types";

function saveSession(u: User) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch { /* quota exceeded */ }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const { user, setUser, reset, rehydrate } = useAppStore();

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

  const logout = () => {
    authService.logout();
    clearSession();
    reset();
  };

  return { user, register, login, enterGuest, logout };
}
