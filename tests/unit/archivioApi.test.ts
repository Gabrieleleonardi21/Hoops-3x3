import { describe, it, expect, vi, beforeEach } from "vitest";
import { token } from "../../src/services/api";
import { archivioApi } from "../../src/services/archivioApi";

/** localStorage e fetch non esistono nell'ambiente node: si sostituiscono con versioni in memoria */
const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);

/** JWT finto che scade tra un'ora (firma non verificata dal client) */
const jwt = () => `intestazione.${btoa(JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }))}.firma`;
const risposta = { tappa: { id: "t1" }, lega: "Circuito", autore: "Anna", autoreId: "u1", ts: 1 };

beforeEach(() => {
  memoria.clear();
  fetchFinto.mockReset();
  fetchFinto.mockImplementation(async () => new Response(JSON.stringify(risposta), { status: 200 }));
});

describe("archivioApi.pubblica: il server costruisce la copia dalla tappa che ha salvato", () => {
  it("PUT /api/archivio/{tappaId} senza corpo e senza Content-Type, con il Bearer", async () => {
    token.set(jwt());
    await archivioApi.pubblica("ba1fd653-0eb0-4275-8f0f-115d350ba2e3");
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/archivio/ba1fd653-0eb0-4275-8f0f-115d350ba2e3");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeUndefined();
    const intestazioni = init.headers as Record<string, string>;
    expect(intestazioni["Content-Type"]).toBeUndefined();
    expect(intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("restituisce la pubblicazione che il server risponde", async () => {
    token.set(jwt());
    await expect(archivioApi.pubblica("t1")).resolves.toEqual(risposta);
  });
});
