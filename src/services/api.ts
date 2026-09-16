/** Client HTTP minimale verso il backend Spring (backend/).
 *  In sviluppo le chiamate a /api passano dal proxy di Vite (vite.config.ts);
 *  in produzione si imposta VITE_API_URL con l'origine del server. */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TOKEN_KEY = "hoop3x3_token";

/** Errore HTTP con lo status del server; status 0 = rete assente / server spento */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Token JWT in localStorage: sopravvive al reload, sparisce al logout */
export const token = {
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => { localStorage.setItem(TOKEN_KEY, t); },
  clear: () => { localStorage.removeItem(TOKEN_KEY); },
};

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** true: la richiesta prosegue anche se la pagina si chiude (salvataggi in uscita) */
  keepalive?: boolean;
}

/** Esegue una chiamata JSON; aggiunge il Bearer token se presente e converte gli errori in ApiError */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      keepalive: opts.keepalive,
    });
  } catch {
    throw new ApiError(0, "Server non raggiungibile: controlla la connessione o avvia il backend.");
  }

  if (!res.ok) {
    // Il backend risponde sempre {message, timestamp}; se il corpo manca si usa lo status
    let message = `Errore ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.message === "string") message = data.message;
    } catch { /* corpo non JSON */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
