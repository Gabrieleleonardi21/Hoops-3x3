// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SyncBanner } from "../../src/components/layout/SyncBanner";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { ApiError } from "../../src/services/api";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa } from "../../src/types";

// Si sostituisce solo la rete delle leghe: store e coda dei salvataggi sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const api = vi.mocked(legheApi);
const store = () => useAppStore.getState();
const tappa = (id: string): Tappa => ({
  id, nome: "Tappa", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  api.putTappa.mockImplementation(async (t) => t);
  useAppStore.setState({ user: { id: "u1", name: "Anna", guest: false }, legaId: "l1", tappe: [tappa("t1"), tappa("t2")] });
  render(<SyncBanner />);
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  vi.useRealTimers();
});

/** Modifica le tappe indicate e lascia passare i 400 ms dopo i quali la coda le salva */
async function modificaESalva(...ids: string[]) {
  await act(async () => {
    for (const id of ids) store().updateTappa(id, { nome: "Finale" });
    await vi.advanceTimersByTimeAsync(400);
  });
}

/** La barra non mostra niente: nessuna riga d'avviso (alert) né delle modifiche non salvate (status) */
function barraVuota() {
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
}

describe("SyncBanner (avviso dei salvataggi)", () => {
  it("un salvataggio che riesce non mostra niente", async () => {
    await modificaESalva("t1");
    expect(api.putTappa).toHaveBeenCalledTimes(1);
    barraVuota();
  });

  it("dopo un salvataggio non riuscito mostra quante tappe non sono salvate e il motivo", async () => {
    api.putTappa.mockRejectedValue(new ApiError(0, "Server non raggiungibile: controlla la connessione o avvia il backend."));
    await modificaESalva("t1", "t2");
    // Una riga «status»: cambia da sola e spesso, e il lettore di schermo non la deve leggere come un allarme
    const avviso = screen.getByRole("status").textContent;
    expect(avviso).toContain("2 tappe hanno modifiche non salvate.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(avviso).toContain("Server non raggiungibile: controlla la connessione");
  });

  it("«Riprova ora» salva subito e l'avviso sparisce da solo quando il salvataggio riesce", async () => {
    api.putTappa.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    await modificaESalva("t1");
    expect(screen.getByRole("status").textContent).toContain("1 tappa ha modifiche non salvate.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Riprova ora" }));
      await vi.advanceTimersByTimeAsync(0);       // senza aspettare i 2 secondi del nuovo tentativo automatico
    });
    expect(api.putTappa).toHaveBeenCalledTimes(2);
    barraVuota();
  });

  it("un 409 perché un altro dispositivo ha salvato la tappa: l'avviso dice che vale la versione del server", async () => {
    api.putTappa.mockRejectedValueOnce(new ApiError(409, "La tappa è stata modificata da un altro dispositivo: ricaricala"));
    api.get.mockResolvedValue({ id: "l1", nome: "Lega", tappe: [{ ...tappa("t1"), nome: "Dell'altro", versione: 8 }, tappa("t2")] });
    await modificaESalva("t1");
    const avviso = screen.getByRole("alert").textContent;
    expect(avviso).toContain("La tappa «Dell'altro» è stata modificata da un altro dispositivo: ora vedi la versione salvata sul server");
    expect(avviso).not.toContain("modifiche non salvate.");   // niente in sospeso: la coda ha scartato la versione superata
    fireEvent.click(screen.getByRole("button", { name: "Chiudi avviso dei conflitti" }));
    barraVuota();
  });

  it("due tappe in conflitto: un solo avviso le nomina tutte e due, e un errore arrivato dopo non lo nasconde", async () => {
    api.putTappa.mockRejectedValue(new ApiError(409, "La tappa è stata modificata da un altro dispositivo: ricaricala"));
    api.get.mockResolvedValue({
      id: "l1", nome: "Lega",
      tappe: [{ ...tappa("t1"), nome: "Prima dell'altro", versione: 8 }, { ...tappa("t2"), nome: "Seconda dell'altro", versione: 8 }],
    });
    await modificaESalva("t1", "t2");
    api.rename.mockRejectedValue(new ApiError(500, "Errore del server"));
    await act(async () => {
      store().setLegaName("Nuovo nome");                     // la rinomina non riesce: un errore meno grave, dopo
      await vi.advanceTimersByTimeAsync(400);
    });
    // Due righe «alert» separate: un errore nuovo fa leggere solo la sua, non di nuovo le frasi dei conflitti
    const [conflitti, errore] = screen.getAllByRole("alert").map((r) => r.textContent);
    expect(conflitti).toContain("La tappa «Prima dell'altro» è stata modificata da un altro dispositivo");
    expect(conflitti).toContain("La tappa «Seconda dell'altro» è stata modificata da un altro dispositivo");
    expect(conflitti).not.toContain("Rinomina lega");
    expect(errore).toBe("Rinomina lega non riuscita: Errore del server");
    fireEvent.click(screen.getByRole("button", { name: "Chiudi avviso" }));
    expect(screen.getByRole("alert").textContent).toContain("«Prima dell'altro»");
    fireEvent.click(screen.getByRole("button", { name: "Chiudi avviso dei conflitti" }));
    barraVuota();
  });
});
