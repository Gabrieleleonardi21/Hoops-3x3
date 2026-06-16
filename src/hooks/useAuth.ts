/** Hook di autenticazione: gestisce login, registrazione e modalità ospite.
 *  La sessione viene persistita in localStorage così il ricaricamento della pagina
 *  non obbliga l'utente a fare il login di nuovo. */
import { useEffect, useState } from "react";
import { useAppStore, SESSION_KEY } from "../stores/useAppStore";
import * as authService from "../services/authService";
import { storage } from "../services/storage";
import type { Account, Lega, User } from "../types";

function saveSession(u: User) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch { /* quota exceeded */ }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const { user, setUser, setLega, reset } = useAppStore();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    authService.loadAccount().then(setAccount);
  }, []);

  const loadLega = async () => {
    try {
      const s = await storage.get("lega3x3");
      const l = JSON.parse(s.value) as Lega;
      setLega(l.nome || "", l.tappe || []);
    } catch { /* nessuna lega salvata */ }
  };

  const register = async (name: string, email: string, pass: string) => {
    const u = await authService.register(name, email, pass);
    setAccount({ name: u.name, email: u.email!, hash: "" });
    setUser(u);
    saveSession(u);
    await loadLega();
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!account) return false;
    const u = await authService.login(account, email, pass);
    if (!u) return false;
    setUser(u);
    saveSession(u);
    await loadLega();
    return true;
  };

  const enterGuest = async () => {
    const u: User = { name: "Ospite", guest: true };
    setUser(u);
    saveSession(u);
    try {
      const s = await storage.get("lega3x3_guest");
      const l = JSON.parse(s.value) as Lega;
      setLega(l.nome || "", l.tappe || []);
    } catch {
      setLega("", []);
    }
  };

  const logout = () => {
    clearSession();
    reset();
  };

  return { user, account, register, login, enterGuest, logout };
}
