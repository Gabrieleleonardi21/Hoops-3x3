/** La rete finta dei test dei client REST (services/*Api.ts), nell'ambiente node: localStorage e fetch non esistono, si sostituiscono
 *  con versioni in memoria. Importarlo basta a installarle; ogni test chiama `azzeraRete()` prima di cominciare. */
import { vi } from "vitest";

const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
export const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);

/** Si riparte da zero: nessun token salvato, nessuna chiamata registrata, il server risponde 200 con `corpo` (JSON) */
export function azzeraRete(corpo: unknown = {}) {
  memoria.clear();
  fetchFinto.mockReset();
  rispondi(corpo);
}

/** Da qui il server finto risponde 200 con questo corpo JSON */
export function rispondi(corpo: unknown) {
  fetchFinto.mockImplementation(async () => new Response(JSON.stringify(corpo), { status: 200 }));
}

/** Da qui il server finto risponde 204, senza corpo (le DELETE) */
export function rispondiSenzaCorpo() {
  fetchFinto.mockImplementation(async () => new Response(null, { status: 204 }));
}

/** Da qui il server finto risponde con questo errore, nel formato del backend ({message}) */
export function rispondiConErrore(status: number, message: string) {
  fetchFinto.mockImplementation(async () => new Response(JSON.stringify({ message }), { status }));
}

/** JWT finto che scade tra un'ora (firma non verificata dal client) */
export const jwtFinto = () => `intestazione.${btoa(JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }))}.firma`;

/** URL, metodo, intestazioni, keepalive e corpo (già letto da JSON, undefined se non c'è) della n-esima chiamata a fetch */
export function chiamata(n = 0) {
  const [url, init] = fetchFinto.mock.calls[n] as [string, RequestInit];
  let corpo: unknown;
  if (init.body !== undefined) corpo = JSON.parse(init.body as string);
  return { url, metodo: init.method, intestazioni: init.headers as Record<string, string>, keepalive: init.keepalive, corpo, init };
}
