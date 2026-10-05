// @vitest-environment jsdom
/** Conferme prima delle eliminazioni definitive di leghe e voci dell'anagrafe (FD-2). Quelle di tappa, squadra di tappa e
 *  tabellone stanno con i test delle loro pagine (TappaPage, BracketSection). */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GiocatoreModal } from "../../src/components/anagrafe/GiocatoreModal";
import { SquadraAnagrafeModal } from "../../src/components/anagrafe/SquadraAnagrafeModal";
import { AnagrafePage } from "../../src/pages/AnagrafePage";
import { LegheListPage } from "../../src/pages/LegheListPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { anagrafeApi } from "../../src/services/anagrafeApi";
import { legheApi } from "../../src/services/legheApi";
import type { RegGiocatore, RegSquadra, User } from "../../src/types";

// Si sostituisce solo la rete (leghe e anagrafe): pagine, store e componenti sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));
vi.mock("../../src/services/anagrafeApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/services/anagrafeApi")>()),
  anagrafeApi: {
    listGiocatori: vi.fn(), createGiocatore: vi.fn(), updateGiocatore: vi.fn(), removeGiocatore: vi.fn(),
    listSquadre: vi.fn(), createSquadra: vi.fn(), updateSquadra: vi.fn(), removeSquadra: vi.fn(),
  },
}));

const leghe = vi.mocked(legheApi);
const anagrafe = vi.mocked(anagrafeApi);
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };

const giocatore = (id: string, nome: string): RegGiocatore => ({
  id, nome, cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "", peso: "",
  ruolo: "Guardia", numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
});
const squadra = (id: string, nome: string, roster: string[] = []): RegSquadra => ({
  id, nome, citta: "", anno: "", rank: "", referente: "", roster, logo: "", website: "", instagram: "", note: "",
  autore: "Anna", autoreId: "u1", ts: 1,
});

/** Il confronto del browser: l'app non deve più usarlo, le conferme sono la sua finestra */
let confermaDelBrowser: MockInstance<typeof window.confirm>;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useAnagrafeStore.setState({ giocatori: null, squadre: null, errore: null, caricata: false });
  confermaDelBrowser = vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  document.body.style.overflow = ""; // il blocco dello scroll delle finestre non deve passare da un test all'altro
  useAppStore.getState().reset();
  vi.restoreAllMocks();
  localStorage.clear();
});

const conferma = () => fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
const annulla = () => fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

describe("Elenco delle leghe: «Elimina lega» chiede conferma con la finestra dell'app", () => {
  const estate = { id: "l1", nome: "Estate", ts: 1, nTappe: 2 };

  function apriLeghe() {
    useAppStore.setState({ user: registrato, leghe: [estate] });
    render(
      <MemoryRouter initialEntries={["/leghe"]}>
        <Routes><Route path="/leghe" element={<LegheListPage />} /></Routes>
      </MemoryRouter>,
    );
  }
  const cestino = () => screen.getByRole("button", { name: "Elimina lega Estate" });

  it("la finestra dice quale lega e quante tappe si perdono; il confronto del browser non si usa", () => {
    apriLeghe();
    fireEvent.click(cestino());
    expect(screen.getByRole("dialog", { name: "Eliminare la lega?" }).textContent)
      .toContain("Verrà eliminata la lega «Estate» con 2 tappe, squadre e risultati compresi.");
    expect(confermaDelBrowser).not.toHaveBeenCalled();
    expect(leghe.remove).not.toHaveBeenCalled(); // finché non si risponde il server non riceve niente
  });

  it("«Annulla» non elimina niente: nessuna DELETE, la lega resta nell'elenco", () => {
    apriLeghe();
    fireEvent.click(cestino());
    annulla();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(leghe.remove).not.toHaveBeenCalled();
    expect(screen.getByText("Estate")).toBeTruthy();
    expect(useAppStore.getState().leghe).toEqual([estate]);
  });

  it("«Conferma» elimina la lega: una sola DELETE, e la lega sparisce dall'elenco", async () => {
    leghe.remove.mockResolvedValue(undefined);
    apriLeghe();
    fireEvent.click(cestino());
    conferma();
    await waitFor(() => expect(screen.getByText(/Nessuna lega ancora/)).toBeTruthy());
    expect(leghe.remove).toHaveBeenCalledExactlyOnceWith("l1");
    expect(confermaDelBrowser).not.toHaveBeenCalled();
  });
});

describe("Anagrafe: le eliminazioni dalle card chiedono conferma", () => {
  beforeEach(() => {
    anagrafe.listGiocatori.mockResolvedValue([giocatore("g1", "Mario")]);
    anagrafe.listSquadre.mockResolvedValue([squadra("s1", "Ballers", ["g1"])]);
  });

  function apriAnagrafe() {
    useAppStore.setState({ user: registrato });
    render(
      <MemoryRouter initialEntries={["/anagrafe"]}>
        <Routes><Route path="/anagrafe" element={<AnagrafePage />} /></Routes>
      </MemoryRouter>,
    );
  }
  const xGiocatore = () => screen.findByRole("button", { name: "Elimina Mario Rossi" });
  const xSquadra = async () => {
    fireEvent.click(await screen.findByRole("tab", { name: /Squadre/ }));
    return screen.findByRole("button", { name: "Elimina Ballers" });
  };

  it("giocatore: la finestra dice che sparisce dall'anagrafe condivisa e dai roster", async () => {
    apriAnagrafe();
    fireEvent.click(await xGiocatore());
    expect(screen.getByRole("dialog", { name: "Eliminare il giocatore?" }).textContent)
      .toContain("Verrà eliminato il giocatore «Mario Rossi» dall'anagrafe condivisa e dai roster delle squadre.");
    expect(anagrafe.removeGiocatore).not.toHaveBeenCalled();
  });

  it("giocatore: «Annulla» non elimina niente; «Conferma» manda una DELETE e la card sparisce", async () => {
    anagrafe.removeGiocatore.mockResolvedValue(undefined);
    apriAnagrafe();
    fireEvent.click(await xGiocatore());
    annulla();
    expect(anagrafe.removeGiocatore).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Mario Rossi" })).toBeTruthy();
    fireEvent.click(await xGiocatore());
    conferma();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mario Rossi" })).toBeNull());
    expect(anagrafe.removeGiocatore).toHaveBeenCalledExactlyOnceWith("g1");
  });

  it("squadra: la finestra dice che sparisce dall'anagrafe e che i giocatori del roster restano", async () => {
    apriAnagrafe();
    fireEvent.click(await xSquadra());
    expect(screen.getByRole("dialog", { name: "Eliminare la squadra?" }).textContent)
      .toContain("Verrà eliminata la squadra «Ballers» dall'anagrafe condivisa. I giocatori del roster restano registrati.");
    expect(anagrafe.removeSquadra).not.toHaveBeenCalled();
  });

  it("squadra: «Annulla» non elimina niente; «Conferma» manda una DELETE e la card sparisce", async () => {
    anagrafe.removeSquadra.mockResolvedValue(undefined);
    apriAnagrafe();
    fireEvent.click(await xSquadra());
    annulla();
    expect(anagrafe.removeSquadra).not.toHaveBeenCalled();
    fireEvent.click(await xSquadra());
    conferma();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ballers" })).toBeNull());
    expect(anagrafe.removeSquadra).toHaveBeenCalledExactlyOnceWith("s1");
  });

  it("dalla scheda aperta: «Elimina» chiede conferma; con «Conferma» il giocatore sparisce e la scheda si chiude", async () => {
    anagrafe.removeGiocatore.mockResolvedValue(undefined);
    apriAnagrafe();
    fireEvent.click(await screen.findByRole("button", { name: "Mario Rossi" }));
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(screen.getByRole("dialog", { name: "Eliminare il giocatore?" })).toBeTruthy();
    expect(anagrafe.removeGiocatore).not.toHaveBeenCalled();
    conferma();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(anagrafe.removeGiocatore).toHaveBeenCalledExactlyOnceWith("g1");
  });
});

describe("Anagrafe: le eliminazioni dalle schede (modali) chiedono conferma", () => {
  /** Gestori della scheda: il server accetta tutto */
  const gestori = () => ({
    onClose: vi.fn<() => void>(),
    onRemove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
  });
  const mostraGiocatore = (g: ReturnType<typeof gestori>) => render(
    <MemoryRouter><GiocatoreModal g={giocatore("g1", "Mario")} user={registrato} {...g} /></MemoryRouter>,
  );
  const mostraSquadra = (g: ReturnType<typeof gestori>) => render(
    <SquadraAnagrafeModal s={squadra("s1", "Ballers")} giocatori={[]} user={registrato} {...g} />,
  );
  const elimina = () => fireEvent.click(screen.getByRole("button", { name: "Elimina" }));

  it.each([
    ["giocatore", mostraGiocatore, "Eliminare il giocatore?", "Verrà eliminato il giocatore «Mario Rossi»"],
    ["squadra", mostraSquadra, "Eliminare la squadra?", "Verrà eliminata la squadra «Ballers»"],
  ])("%s: «Elimina» apre la conferma e non elimina; «Annulla» lascia la scheda aperta", (_tipo, mostra, titolo, testo) => {
    const g = gestori();
    mostra(g);
    elimina();
    expect(screen.getByRole("dialog", { name: titolo }).textContent).toContain(testo);
    expect(g.onRemove).not.toHaveBeenCalled();
    annulla();
    expect(screen.queryByRole("dialog", { name: titolo })).toBeNull();
    expect(g.onRemove).not.toHaveBeenCalled();
    expect(g.onClose).not.toHaveBeenCalled();
  });

  it.each([
    ["giocatore", mostraGiocatore],
    ["squadra", mostraSquadra],
  ])("%s: «Conferma» elimina e, se il server accetta, chiude la scheda", async (_tipo, mostra) => {
    const g = gestori();
    mostra(g);
    elimina();
    conferma();
    await waitFor(() => expect(g.onClose).toHaveBeenCalledTimes(1));
    expect(g.onRemove).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["giocatore", mostraGiocatore],
    ["squadra", mostraSquadra],
  ])("%s: Esc, con la conferma aperta, annulla solo la conferma; la scheda resta e un Esc dopo la chiude", (_tipo, mostra) => {
    const g = gestori();
    mostra(g);
    elimina();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Conferma" })).toBeNull(); // la conferma è chiusa
    expect(g.onClose).not.toHaveBeenCalled();   // la scheda no
    expect(g.onRemove).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(g.onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["giocatore", mostraGiocatore],
    ["squadra", mostraSquadra],
  ])("%s: se con la conferma aperta si smonta tutto insieme (tasto «Indietro»), lo scroll della pagina torna", (_tipo, mostra) => {
    const { unmount } = mostra(gestori());
    elimina();
    expect(screen.getByRole("dialog", { name: /Eliminare/ })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("giocatore: se il server rifiuta, la scheda resta aperta con il motivo e la conferma non si ripresenta da sola", async () => {
    const g = gestori();
    g.onRemove.mockRejectedValue(new Error("boom"));
    mostraGiocatore(g);
    elimina();
    conferma();
    expect((await screen.findByRole("alert")).textContent).toContain("Eliminazione non riuscita");
    expect(screen.queryByRole("button", { name: "Conferma" })).toBeNull();
    expect(g.onClose).not.toHaveBeenCalled();
    await act(async () => {});
  });
});
