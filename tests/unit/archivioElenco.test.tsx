// @vitest-environment jsdom
/** Elenco dell'archivio con la forma sintetica del server (T2.2): la pagina vera, con l'api vera e solo la rete finta. Prova che le
 *  righe si disegnano dagli otto campi della voce, che l'ordine è quello del server e che una risposta con la forma di prima (il
 *  frontend nuovo che parla con il backend non ancora aggiornato) dà l'errore con «Riprova»: mai una pagina bianca né righe vuote. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { ArchivioPage } from "../../src/pages/ArchivioPage";

const fetchFinto = vi.fn();

beforeEach(() => {
  fetchFinto.mockReset();
  vi.stubGlobal("fetch", fetchFinto);
  localStorage.clear();
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Una voce dell'elenco, com'è nella risposta di GET /api/archivio */
const voce = (tappaId: string, nome: string, resto: Record<string, unknown> = {}) => ({
  tappaId, nome, luogo: "Roma", data: "2025-09-13", nSquadre: 8, lega: "Estate", autore: "Admin", ts: 1, ...resto,
});
/** Una voce con la forma di prima: la tappa intera dentro, e nessuno degli otto campi sintetici */
const voceVecchia = (nome: string) => ({ tappa: { id: "t1", nome, squadre: [] }, lega: "Estate", autore: "Anna", autoreId: "u1", ts: 1 });

/** Il server risponde 200 con questo corpo */
const rispondi = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200 });

/** Destinazione del clic su una riga: dice quale tappa si è aperta */
function TappaAperta() {
  return <p>Aperta la tappa {useParams().id}</p>;
}

function apri() {
  render(
    <MemoryRouter initialEntries={["/archivio"]}>
      <Routes>
        <Route path="/archivio" element={<ArchivioPage />} />
        <Route path="/tappa/:id" element={<TappaAperta />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Elenco dell'archivio: la voce sintetica", () => {
  it("ogni riga dice nome, lega · luogo · data, squadre e autore, dai campi della voce", async () => {
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Finals – Roma", { nSquadre: 8, autore: "Admin" })]));
    apri();
    const riga = (await screen.findByText("Finals – Roma")).closest("button")!;
    expect(riga.textContent).toContain("Estate · Roma · 2025-09-13");
    expect(riga.textContent).toContain("8 squadre · di Admin");
  });

  it("senza luogo e data (stringhe vuote) restano la lega, senza separatori in più", async () => {
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Tappa nuda", { luogo: "", data: "" })]));
    apri();
    await screen.findByText("Tappa nuda");
    // Il sottotitolo è proprio «Estate»: la ricerca è per testo intero, quindi un «·» in più non lo troverebbe
    expect(screen.getByText("Estate")).toBeTruthy();
  });

  it("l'ordine delle righe è quello del server: niente riordino lato client", async () => {
    // Timestamp né crescenti né decrescenti: un riordino per data o per nome cambierebbe l'ordine
    fetchFinto.mockResolvedValue(rispondi([voce("m", "Mezzo", { ts: 5 }), voce("z", "Ultima", { ts: 9 }), voce("a", "Prima", { ts: 1 })]));
    apri();
    await screen.findByText("Mezzo");
    const nomi = screen.getAllByRole("button").map((b) => b.querySelector("strong")?.textContent);
    expect(nomi).toEqual(["Mezzo", "Ultima", "Prima"]);
  });

  it("il clic su una riga apre la pagina pubblica di quella tappa, dall'id della voce", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    fetchFinto.mockResolvedValue(rispondi([voce("altra", "Altra tappa"), voce(id, "Tappa scelta")]));
    apri();
    fireEvent.click((await screen.findByText("Tappa scelta")).closest("button")!);
    expect(await screen.findByText(`Aperta la tappa ${id}`)).toBeTruthy();
  });

  it("archivio davvero vuoto: il messaggio di sempre, senza errori", async () => {
    fetchFinto.mockResolvedValue(rispondi([]));
    apri();
    expect(await screen.findByText(/L'archivio è vuoto/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Elenco dell'archivio: la forma di prima è un errore visibile (Ruling I1 del backend)", () => {
  it("risposta con la forma vecchia: l'errore con «Riprova», nessuna riga (nemmeno vuota), né «archivio vuoto», né caricamento infinito", async () => {
    fetchFinto.mockResolvedValue(rispondi([voceVecchia("Finale di Roma"), voceVecchia("Semifinale")]));
    apri();
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Non è stato possibile caricare l'archivio del circuito");
    expect(avviso.textContent).toContain("Risposta del server non valida");
    // L'unico pulsante è «Riprova»: nessuna riga dell'elenco, né col nome della tappa né vuota
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Riprova"]);
    expect(screen.queryByText("Finale di Roma")).toBeNull();
    expect(screen.queryByText(/L'archivio è vuoto/)).toBeNull();
    expect(screen.queryByText(/Sto aprendo l'archivio/)).toBeNull();
  });

  it("una sola voce vecchia in un elenco di voci nuove: errore per l'elenco intero, non una lista a metà", async () => {
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Tappa buona"), voceVecchia("Tappa vecchia")]));
    apri();
    await screen.findByRole("alert");
    expect(screen.queryByText("Tappa buona")).toBeNull();
  });

  it("«Riprova» dopo che il server è passato alla forma nuova mostra l'elenco, e l'errore sparisce", async () => {
    fetchFinto.mockResolvedValueOnce(rispondi([voceVecchia("Finale di Roma")]));
    apri();
    await screen.findByRole("alert");
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Finale di Roma")]));
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Finale di Roma")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchFinto).toHaveBeenCalledTimes(2);
  });
});
