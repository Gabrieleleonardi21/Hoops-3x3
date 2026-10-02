import { describe, it, expect, vi, beforeEach } from "vitest";
import { logout, me } from "../../src/services/authService";
import { token } from "../../src/services/api";

/** localStorage e fetch non esistono nell'ambiente node: si sostituiscono con versioni in memoria */
const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);

beforeEach(() => {
  memoria.clear();
  fetchFinto.mockReset();
});

describe("authService.logout", () => {
  it("butta via subito il JWT e revoca il refresh token sul server", async () => {
    token.set("jwt-di-prova");
    let tokenDuranteLaChiamata: string | null = "richiesta mai partita";
    fetchFinto.mockImplementationOnce(async () => {
      tokenDuranteLaChiamata = token.get();
      return new Response(null, { status: 204 });
    });
    await logout();
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(fetchFinto.mock.calls[0][0]).toBe("/api/auth/logout");
    expect((fetchFinto.mock.calls[0][1] as RequestInit).method).toBe("POST");
    // keepalive: la revoca deve partire anche se la scheda viene chiusa subito dopo «Esci»
    expect((fetchFinto.mock.calls[0][1] as RequestInit).keepalive).toBe(true);
    // Quando la richiesta parte il JWT è già sparito: da lì la scheda non può più fare rinnovi
    expect(tokenDuranteLaChiamata).toBeNull();
    expect(token.get()).toBeNull();
  });

  it("senza JWT (ospite o sessione già chiusa) non chiama il server", async () => {
    await logout();
    expect(fetchFinto).not.toHaveBeenCalled();
  });

  it("se il server non risponde si esce lo stesso, senza eccezioni", async () => {
    token.set("jwt-di-prova");
    fetchFinto.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(logout()).resolves.toBeUndefined();
    expect(token.get()).toBeNull();
  });
});

describe("authService.me", () => {
  const json = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
  const respinto = () => json(401, { message: "Sessione scaduta: accedi di nuovo", timestamp: "2026-10-02T10:00:00" });

  it("con un errore di rete restituisce «irraggiungibile» e conserva il token", async () => {
    token.set("jwt-di-prova");
    fetchFinto.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(me()).resolves.toEqual({ esito: "irraggiungibile" });
    expect(token.get()).toBe("jwt-di-prova");
  });

  it("sessione valida: restituisce l'utente com'è sul server", async () => {
    token.set("jwt-di-prova");
    fetchFinto.mockResolvedValueOnce(json(200, { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "ADMIN" }));
    await expect(me()).resolves.toEqual({
      esito: "valida", user: { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "ADMIN", guest: false },
    });
    expect(token.get()).toBe("jwt-di-prova");
  });

  it("JWT e refresh token respinti: «scaduta» e token cancellato", async () => {
    token.set("jwt-di-prova");
    fetchFinto.mockResolvedValueOnce(respinto()).mockResolvedValueOnce(respinto());
    await expect(me()).resolves.toEqual({ esito: "scaduta" });
    expect(fetchFinto.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(token.get()).toBeNull();
  });

  it("senza token: «scaduta» senza chiamare il server", async () => {
    await expect(me()).resolves.toEqual({ esito: "scaduta" });
    expect(fetchFinto).not.toHaveBeenCalled();
  });

  it("errore del server (500): «irraggiungibile» e token conservato", async () => {
    token.set("jwt-di-prova");
    fetchFinto.mockResolvedValueOnce(json(500, { message: "Errore interno del server", timestamp: "2026-10-02T10:00:00" }));
    await expect(me()).resolves.toEqual({ esito: "irraggiungibile" });
    expect(token.get()).toBe("jwt-di-prova");
  });

  it("JWT respinto ma rinnovo non riuscito per la rete: «irraggiungibile», la sessione può essere ancora valida", async () => {
    token.set("jwt-di-prova");
    fetchFinto.mockResolvedValueOnce(respinto()).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(me()).resolves.toEqual({ esito: "irraggiungibile" });
    expect(token.get()).toBe("jwt-di-prova");
  });
});
