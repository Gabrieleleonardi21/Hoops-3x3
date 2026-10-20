// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useLega } from "../../src/hooks/useLega";
import { useAppStore } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa } from "../../src/types";

// Si sostituisce solo la rete delle leghe: l'hook e lo store sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(async (_legaId: string, t: Tappa) => t), putTappa: vi.fn(async (t: Tappa) => t), removeTappa: vi.fn(),
  },
}));

/** Tappa vuota con il nome dato */
const tappaNominata = (id: string, nome: string): Tappa => ({
  id, nome, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
});

describe("useLega.createTappa: il nome predefinito «Tappa N» non si ripete", () => {
  it("con «Tappa 1» e «Tappa 3» nella lega, una tappa senza nome diventa «Tappa 2»", () => {
    useAppStore.setState({ tappe: [tappaNominata("a", "Tappa 1"), tappaNominata("b", "Tappa 3")] });
    const { result } = renderHook(() => useLega());
    const esito = result.current.createTappa({ nome: "  ", luogo: "", data: "", nTeams: 4, nGironi: 2 });
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.tappa.nome).toBe("Tappa 2");
  });

  it("con un nome scritto, il nome resta quello scritto", () => {
    useAppStore.setState({ tappe: [tappaNominata("a", "Tappa 1")] });
    const { result } = renderHook(() => useLega());
    const esito = result.current.createTappa({ nome: "Finale", luogo: "", data: "", nTeams: 4, nGironi: 2 });
    if (!esito.ok) throw new Error(esito.errore);
    expect(esito.tappa.nome).toBe("Finale");
  });
});
