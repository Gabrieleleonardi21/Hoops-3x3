// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAuth } from "../../src/hooks/useAuth";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { useCampettiStore } from "../../src/stores/useCampettiStore";
import { token } from "../../src/services/api";
import { CAMPETTI_DEMO } from "../fixtures/campetti";
import type { User } from "../../src/types";
import { azzeraRete, fetchFinto, jwtFinto, rispondiConErrore, rispondiSenzaCorpo } from "./reteFinta";

// Fase 6: il profilo cambia l'utente di sessione (aggiorna) o lo toglie del tutto (eliminaAccount). Lo store, le cache e il client
// HTTP sono quelli veri; il server è finto (reteFinta)
const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };

/** Mette in cache dell'anagrafe e dei campetti qualcosa che contiene il nome vecchio (come autore), e una lega aperta */
function riempi() {
  useAnagrafeStore.setState({ giocatori: [], squadre: [], caricata: true });
  useCampettiStore.setState({ campetti: CAMPETTI_DEMO, ricerca: { q: "Torino" }, svuotata: 0 });
  useAppStore.setState({ user: anna, legaId: "l1", legaName: "Estate" });
}

beforeEach(() => {
  azzeraRete();
  token.set(jwtFinto());
  localStorage.setItem(SESSION_KEY, JSON.stringify(anna));
  useAnagrafeStore.getState().svuota();
  riempi();
});

afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
  useAnagrafeStore.getState().svuota();
});

describe("useAuth.aggiorna", () => {
  it("scrive l'utente nello store e nella sessione del browser, e svuota le cache dell'anagrafe e dei campetti (hanno il vecchio nome come autore)", () => {
    const { result } = renderHook(() => useAuth());
    const rinominata: User = { ...anna, name: "Anna Rossi" };
    act(() => result.current.aggiorna(rinominata));
    expect(useAppStore.getState().user).toEqual(rinominata);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null")).toEqual(rinominata);
    expect(useAnagrafeStore.getState()).toMatchObject({ giocatori: null, squadre: null, caricata: false });
    expect(useCampettiStore.getState()).toMatchObject({ campetti: null, ricerca: null, svuotata: 1 });
  });
});

describe("useAuth.eliminaAccount", () => {
  it("con il 204 del server non resta niente nel browser: token, sessione, lega aperta, cache e utente", async () => {
    rispondiSenzaCorpo();
    const { result } = renderHook(() => useAuth());
    await act(() => result.current.eliminaAccount("la-mia-pass"));
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().user).toBeNull();
    expect(useAppStore.getState().legaId).toBeNull();
    expect(localStorage.getItem("hoop3x3_token")).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(useAnagrafeStore.getState()).toMatchObject({ giocatori: null, caricata: false });
    expect(useCampettiStore.getState()).toMatchObject({ campetti: null, svuotata: 1 });
  });

  it("con il server a 400 lancia l'errore e lascia tutto com'è: l'utente resta dentro", async () => {
    rispondiConErrore(400, "La password attuale non è corretta");
    const { result } = renderHook(() => useAuth());
    let errore: unknown;
    await act(async () => { errore = await result.current.eliminaAccount("sbagliata").catch((e: unknown) => e); });
    expect(errore).toMatchObject({ status: 400, message: "La password attuale non è corretta" });
    expect(useAppStore.getState().user).toEqual(anna);
    expect(useAppStore.getState().legaId).toBe("l1");
    expect(localStorage.getItem("hoop3x3_token")).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(useAnagrafeStore.getState().caricata).toBe(true);
    expect(useCampettiStore.getState().campetti).toEqual(CAMPETTI_DEMO);
  });
});
