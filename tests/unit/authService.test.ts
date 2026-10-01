import { describe, it, expect, vi, beforeEach } from "vitest";
import { logout } from "../../src/services/authService";
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
