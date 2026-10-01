/** Autenticazione contro il backend: JWT in localStorage (vedi api.ts) rinnovato con il refresh token
 *  in cookie httpOnly; la password non viene mai salvata. */
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

/** Logout: butta via subito il JWT (da qui la scheda non fa più richieste autenticate né rinnovi), poi
 *  revoca il refresh token sul server, che cancella il cookie. Senza JWT (ospite, sessione già chiusa) non
 *  c'è niente da revocare. Se il server non risponde si è usciti lo stesso. */
export async function logout() {
  if (!token.get()) return;
  token.clear();
  await api<void>("/api/auth/logout", { method: "POST" }).catch(() => {});
}
