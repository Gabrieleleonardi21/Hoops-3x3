// @vitest-environment jsdom
/** Elenco dell'archivio con la forma sintetica del server (T2.2): la pagina vera, con l'api vera e solo la rete finta. Prova che le
 *  righe si disegnano dagli otto campi della voce, che l'ordine è quello del server e che una risposta con la forma di prima (il
 *  frontend nuovo che parla con il backend non ancora aggiornato) dà l'errore con «Riprova»: mai una pagina bianca né righe vuote. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { ArchivioPage } from "../../src/pages/ArchivioPage";
import { useAppStore } from "../../src/stores/useAppStore";
import type { User } from "../../src/types";

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
  useAppStore.setState({ user: null }); // l'utente di un test non passa al successivo
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

  it("il numero di squadre è al singolare e al plurale: «1 squadra», «0 squadre», «8 squadre»", async () => {
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Una sola", { nSquadre: 1 }), voce("b", "Nessuna", { nSquadre: 0 }), voce("c", "Otto")]));
    apri();
    const riga = async (nome: string) => (await screen.findByText(nome)).closest("button")!.textContent;
    expect(await riga("Una sola")).toContain("1 squadra · di Admin");
    expect(await riga("Una sola")).not.toContain("1 squadre");
    expect(await riga("Nessuna")).toContain("0 squadre · di Admin");
    expect(await riga("Otto")).toContain("8 squadre · di Admin");
  });

  it("senza luogo e data (stringhe vuote) restano la lega, senza separatori in più", async () => {
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Tappa nuda", { luogo: "", data: "" })]));
    apri();
    await screen.findByText("Tappa nuda");
    // Il sottotitolo della riga è proprio «Estate» (l'intestazione della lega sta fuori dalla riga): un «·» in più non lo troverebbe
    expect(within(await screen.findByRole("button", { name: /^Tappa nuda/ })).getByText("Estate")).toBeTruthy();
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

/** Un utente registrato (o l'ADMIN) nello store: la pagina decide da lì chi vede «Ritira» */
const utente = (id: string, ruolo: "USER" | "ADMIN" = "USER"): User => ({ id, name: "Anna", email: "anna@example.it", guest: false, ruolo });

describe("Elenco dell'archivio: le tappe per lega", () => {
  it("le tappe sono raggruppate per lega con il nome della lega come titolo", async () => {
    fetchFinto.mockResolvedValue(rispondi([
      voce("a", "Tappa A", { legaId: "l1", lega: "Estate" }),
      voce("b", "Tappa B", { legaId: "l2", lega: "Inverno" }),
      voce("c", "Tappa C", { legaId: "l1", lega: "Estate" }),
    ]));
    apri();
    const estate = await screen.findByRole("region", { name: "Estate" });
    expect(within(estate).getByText("Tappa A")).toBeTruthy();
    expect(within(estate).getByText("Tappa C")).toBeTruthy();
    expect(within(estate).queryByText("Tappa B")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Inverno" })).getByText("Tappa B")).toBeTruthy();
  });
});

describe("Elenco dell'archivio: «Ritira» sulle proprie pubblicazioni", () => {
  /** Un server finto con l'elenco in memoria: il DELETE toglie la voce, la GET successiva non la rimanda */
  function serverConElenco(elenco: ReturnType<typeof voce>[]) {
    let attuale = elenco;
    fetchFinto.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        attuale = attuale.filter((v) => `/api/archivio/${v.tappaId}` !== url);
        return new Response(null, { status: 204 });
      }
      return rispondi(attuale);
    });
  }

  it("l'autore vede «Ritira» solo sulle sue; la conferma manda DELETE e l'elenco si ricarica senza la voce", async () => {
    useAppStore.setState({ user: utente("u1") });
    serverConElenco([voce("a", "Tappa A", { autoreId: "u1" }), voce("b", "Tappa B", { autoreId: "u2" })]);
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Ritira Tappa A dall'archivio" }));
    expect(await screen.findByText(/La tappa esce dall'archivio pubblico/)).toBeTruthy();
    expect(fetchFinto.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false); // prima della conferma non parte niente
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: /^Tappa A/ })).toBeNull());
    expect(fetchFinto).toHaveBeenCalledWith("/api/archivio/a", expect.objectContaining({ method: "DELETE" }));
    expect(screen.getByRole("button", { name: /^Tappa B/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ritira Tappa B dall'archivio" })).toBeNull();
  });

  it("l'ADMIN lo vede su tutte, e la conferma dice di chi è la pubblicazione", async () => {
    useAppStore.setState({ user: utente("u9", "ADMIN") });
    serverConElenco([voce("a", "Tappa A", { autoreId: "u1", autore: "Anna" }), voce("b", "Tappa B", { autoreId: "u2", autore: "Marco" })]);
    apri();
    expect(await screen.findByRole("button", { name: "Ritira Tappa A dall'archivio" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ritira Tappa B dall'archivio" }));
    expect(await screen.findByText(/Pubblicata da Marco/)).toBeTruthy();
  });

  it("ospite o senza account: nessun «Ritira», anche sulla voce di chi si chiama come l'autore", async () => {
    serverConElenco([voce("a", "Tappa A", { autoreId: "u1" })]);
    useAppStore.setState({ user: { name: "Anna", guest: true } });
    apri();
    expect(await screen.findByRole("button", { name: /^Tappa A/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Ritira/ })).toBeNull();
    cleanup();
    useAppStore.setState({ user: null });
    apri();
    expect(await screen.findByRole("button", { name: /^Tappa A/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Ritira/ })).toBeNull();
  });

  it("se il server rifiuta (403) l'errore compare nell'avviso e l'elenco resta", async () => {
    useAppStore.setState({ user: utente("u1") });
    serverConElenco([voce("a", "Tappa A", { autoreId: "u1" })]);
    fetchFinto.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(JSON.stringify({ message: "Solo l'autore può ritirarla" }), { status: 403 });
      return rispondi([voce("a", "Tappa A", { autoreId: "u1" })]);
    });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Ritira Tappa A dall'archivio" }));
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Solo l'autore può ritirarla");
    expect(screen.getByRole("button", { name: /^Tappa A/ })).toBeTruthy();
  });

  it("il 404 sulla DELETE vuol dire che la tappa era già tolta: nessun errore, la riga sparisce", async () => {
    useAppStore.setState({ user: utente("u1") });
    // Un altro ha già tolto la voce: la DELETE risponde 404 e la GET successiva non la rimanda più
    let elenco = [voce("a", "Tappa A", { autoreId: "u1" }), voce("b", "Tappa B", { autoreId: "u2" })];
    fetchFinto.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        elenco = elenco.filter((v) => v.tappaId !== "a");
        return new Response(JSON.stringify({ message: "Tappa non trovata" }), { status: 404 });
      }
      return rispondi(elenco);
    });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Ritira Tappa A dall'archivio" }));
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: /^Tappa A/ })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /^Tappa B/ })).toBeTruthy();
  });

  it("la DELETE riesce ma il ricaricamento dopo fallisce: la voce ritirata esce comunque dall'elenco", async () => {
    useAppStore.setState({ user: utente("u1") });
    let ritirata = false;
    fetchFinto.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        ritirata = true;
        return new Response(null, { status: 204 });
      }
      // La prima lettura riesce; dopo la DELETE il server non risponde più
      if (ritirata) return new Response(JSON.stringify({ message: "Errore interno" }), { status: 500 });
      return rispondi([voce("a", "Tappa A", { autoreId: "u1" }), voce("b", "Tappa B", { autoreId: "u2" })]);
    });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Ritira Tappa A dall'archivio" }));
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: /^Tappa A/ })).toBeNull());
    expect(screen.getByRole("button", { name: /^Tappa B/ })).toBeTruthy();
  });

  it("la DELETE riesce ma il ricaricamento dopo fallisce: l'errore compare nella pagina, anche se l'elenco c'è ancora", async () => {
    useAppStore.setState({ user: utente("u1") });
    let ritirata = false;
    fetchFinto.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        ritirata = true;
        return new Response(null, { status: 204 });
      }
      if (ritirata) return new Response(JSON.stringify({ message: "Errore interno" }), { status: 500 });
      return rispondi([voce("a", "Tappa A", { autoreId: "u1" }), voce("b", "Tappa B", { autoreId: "u2" })]);
    });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Ritira Tappa A dall'archivio" }));
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    // L'avviso dice che l'elenco non si è aggiornato e perché: senza, l'utente non sa se la voce è davvero tolta
    expect((await screen.findByRole("alert")).textContent).toContain("Errore interno");
    expect(screen.queryByRole("button", { name: /^Tappa A/ })).toBeNull();
  });

  it("con l'elenco di prima (otto campi) la pagina si disegna come oggi: righe e lega, senza «Ritira»", async () => {
    useAppStore.setState({ user: utente("u1") });
    fetchFinto.mockResolvedValue(rispondi([voce("a", "Tappa vecchia")]));
    apri();
    const riga = await screen.findByRole("button", { name: /^Tappa vecchia/ });
    expect(riga.textContent).toContain("Estate · Roma · 2025-09-13");
    expect(riga.textContent).toContain("8 squadre · di Admin");
    expect(within(screen.getByRole("region", { name: "Estate" })).getByText("Tappa vecchia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Ritira/ })).toBeNull();
  });
});
