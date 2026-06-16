/** Hook di autenticazione: gestisce login, registrazione e modalità ospite.
 *  La sessione viene persistita in localStorage così il ricaricamento della pagina
 *  non obbliga l'utente a fare il login di nuovo. */
import { useEffect, useState } from "react";
import { useAppStore, SESSION_KEY } from "../stores/useAppStore";
import * as authService from "../services/authService";
import type { Account, User } from "../types";

function saveSession(u: User) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch { /* quota exceeded */ }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const { user, setUser, reset, rehydrate } = useAppStore();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    authService.loadAccount().then(setAccount);
  }, []);

  const register = async (name: string, email: string, pass: string) => {
    const u = await authService.register(name, email, pass);
    setAccount({ name: u.name, email: u.email!, hash: "" });
    setUser(u);
    saveSession(u);
    rehydrate(); // ripristina leghe e lega attiva da localStorage
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!account) return false;
    const u = await authService.login(account, email, pass);
    if (!u) return false;
    setUser(u);
    saveSession(u);
    rehydrate(); // ripristina leghe e lega attiva da localStorage
    return true;
  };

  const enterGuest = async () => {
    const u: User = { name: "Ospite", guest: true };
    setUser(u);
    saveSession(u);
    rehydrate(); // ripristina eventuale sessione ospite precedente
  };

  const logout = () => {
    clearSession();
    reset();
  };

  return { user, account, register, login, enterGuest, logout };
}
