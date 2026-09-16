/** Autenticazione contro il backend: JWT in localStorage (vedi api.ts), password mai salvata. */
import { api, token } from "./api";
import type { User } from "../types";

interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string; ruolo: "USER" | "ADMIN" };
}

function toUser(u: AuthResponse["user"]): User {
  return { id: u.id, name: u.name, email: u.email, ruolo: u.ruolo, guest: false };
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const r = await api<AuthResponse>("/api/auth/register", { method: "POST", body: { name, email, password } });
  token.set(r.token);
  return toUser(r.user);
}

export async function login(email: string, password: string): Promise<User> {
  const r = await api<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } });
  token.set(r.token);
  return toUser(r.user);
}

/** Verifica il token salvato; null se assente o scaduto (in quel caso lo rimuove) */
export async function me(): Promise<User | null> {
  if (!token.get()) return null;
  try {
    return toUser(await api<AuthResponse["user"]>("/api/auth/me"));
  } catch {
    token.clear();
    return null;
  }
}

export function logout() {
  token.clear();
}
