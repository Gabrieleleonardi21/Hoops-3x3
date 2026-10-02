/** Autenticazione contro il backend: JWT in localStorage (vedi api.ts) rinnovato con il refresh token
 *  in cookie httpOnly; la password non viene mai salvata. */
import { api, ApiError, token } from "./api";
import type { User } from "../types";

/** Esito della verifica della sessione salvata (me) */
export type EsitoSessione =
  | { esito: "valida"; user: User }
  | { esito: "scaduta" }
  | { esito: "irraggiungibile" };

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

/** Verifica la sessione salvata (un JWT scaduto si rinnova dentro api()). Tre esiti:
 *  - `valida`, con l'utente com'è sul server;
 *  - `scaduta`: il token manca, oppure il server ha respinto JWT e refresh token (api() ha già cancellato il token);
 *  - `irraggiungibile`: rete assente, server che non risponde o in errore, rinnovo non riuscito per la rete. La sessione
 *    può essere ancora valida: il token resta, e un server irraggiungibile per un momento non fa uscire l'utente. */
export async function me(): Promise<EsitoSessione> {
  if (!token.get()) return { esito: "scaduta" };
  try {
    return { esito: "valida", user: toUser(await api<AuthResponse["user"]>("/api/auth/me")) };
  } catch (e) {
    // Un 401 con il token ancora presente vuol dire rinnovo non riuscito per la rete o una gara: niente di certo
    if (e instanceof ApiError && e.status === 401 && !token.get()) return { esito: "scaduta" };
    return { esito: "irraggiungibile" };
  }
}

/** Logout: butta via subito il JWT (da qui la scheda non fa più richieste autenticate né rinnovi), poi
 *  revoca il refresh token sul server, che cancella il cookie. Senza JWT (ospite, sessione già chiusa) non
 *  c'è niente da revocare. Se il server non risponde si è usciti lo stesso.
 *  keepalive: la revoca parte anche se la scheda viene chiusa subito dopo «Esci». */
export async function logout() {
  if (!token.get()) return;
  token.clear();
  await api<void>("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
}
