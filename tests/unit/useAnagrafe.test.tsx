// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAnagrafe } from "../../src/hooks/useAnagrafe";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { ApiError } from "../../src/services/api";
import type { RegGiocatore, RegSquadra } from "../../src/types";

// Si sostituisce solo la rete: store e hook sono quelli veri. Qui si prova che una pagina già aperta riscarica l'anagrafe quando la
// cache viene svuotata (accesso, uscita, anche in un'altra scheda), in qualunque stato fosse: caricata, in errore, in caricamento
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/services/anagrafeApi")>();
  return {
    ...reale,
    anagrafeApi: {
      listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
      listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
    },
  };
});

const api = vi.mocked(anagrafeApi);
const store = () => useAnagrafeStore.getState();

/** Lo stesso giocatore com'è senza account (forma pubblica) e con un account (forma completa) */
const pubblico: RegGiocatore = {
  id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "",
  ruolo: "Guardia", numero: "7", squadra: "", esperienza: "", note: "", autore: "", autoreId: null, ts: 1,
};
const completo: RegGiocatore = { ...pubblico, nascita: "1998-03-15", autore: "Anna", autoreId: "u1" };

/** Una promessa che si risolve quando lo decide il test: il server che risponde in ritardo */
function differita<T>() {
  let risolvi: (valore: T) => void = () => {};
  const promessa = new Promise<T>((ok) => { risolvi = ok; });
  return { promessa, risolvi };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.listGiocatori.mockResolvedValue([pubblico]);
  api.listSquadre.mockResolvedValue([] as RegSquadra[]);
  store().svuota();
});

afterEach(() => {
  cleanup();
  store().svuota();
});

describe("useAnagrafe: una pagina aperta riscarica da sola quando la cache viene svuotata", () => {
  it("con l'anagrafe caricata riparte e prende i dati nuovi", async () => {
    const { result } = renderHook(() => useAnagrafe());
    await waitFor(() => expect(result.current.caricata).toBe(true));
    api.listGiocatori.mockResolvedValue([completo]);
    act(() => { store().svuota(); });
    await waitFor(() => expect(result.current.giocatori).toEqual([completo]));
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
  });

  it("dopo un errore («Riprova» a video) riparte lo stesso: non resta ferma su «Sto aprendo l'anagrafe…»", async () => {
    api.listGiocatori.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    const { result } = renderHook(() => useAnagrafe());
    await waitFor(() => expect(result.current.errore).toBe("Servizio non disponibile"));
    expect(api.listGiocatori).toHaveBeenCalledTimes(1);
    // L'utente accede in un'altra scheda: la cache si svuota mentre qui c'è l'errore
    api.listGiocatori.mockResolvedValue([completo]);
    act(() => { store().svuota(); });
    await waitFor(() => expect(result.current.giocatori).toEqual([completo]));
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
    expect(result.current.errore).toBeNull();
  });

  it("con una richiesta in volo (avvio a freddo del server) ne parte una nuova, e la risposta vecchia non conta", async () => {
    const lenta = differita<RegGiocatore[]>();
    api.listGiocatori.mockReturnValueOnce(lenta.promessa);
    const { result } = renderHook(() => useAnagrafe());
    await waitFor(() => expect(api.listGiocatori).toHaveBeenCalledTimes(1));
    // Accesso mentre la prima richiesta, partita senza token, è ancora in attesa
    api.listGiocatori.mockResolvedValue([completo]);
    act(() => { store().svuota(); });
    await waitFor(() => expect(result.current.giocatori).toEqual([completo]));
    expect(api.listGiocatori).toHaveBeenCalledTimes(2);
    // La risposta di prima arriva adesso, in forma pubblica: non sovrascrive i dati completi
    await act(async () => { lenta.risolvi([pubblico]); });
    expect(result.current.giocatori).toEqual([completo]);
    expect(result.current.caricata).toBe(true);
  });

  it("senza svuotamento un errore non provoca altri tentativi: niente raffica di richieste", async () => {
    api.listGiocatori.mockRejectedValue(new ApiError(503, "Servizio non disponibile"));
    const { result } = renderHook(() => useAnagrafe());
    await waitFor(() => expect(result.current.errore).not.toBeNull());
    await act(async () => { await new Promise((fatto) => setTimeout(fatto, 30)); });
    expect(api.listGiocatori).toHaveBeenCalledTimes(1);
  });
});
