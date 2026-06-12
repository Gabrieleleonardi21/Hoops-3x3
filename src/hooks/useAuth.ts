import { useEffect, useState } from "react";
import { useAppStore } from "../stores/useAppStore";
import * as authService from "../services/authService";
import { storage } from "../services/storage";
import type { Account, Lega } from "../types";

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
    } catch {
      /* nessuna lega salvata */
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    const u = await authService.register(name, email, pass);
    setAccount({ name: u.name, email: u.email!, hash: "" });
    setUser(u);
    await loadLega();
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!account) return false;
    const u = await authService.login(account, email, pass);
    if (!u) return false;
    setUser(u);
    await loadLega();
    return true;
  };

  const enterGuest = () => {
    setLega("", []);
    setUser({ name: "Ospite", guest: true });
  };

  const logout = () => reset();

  return { user, account, register, login, enterGuest, logout };
}
