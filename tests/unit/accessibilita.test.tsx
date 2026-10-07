// @vitest-environment jsdom
/** Accessibilità dei componenti di base (T2.13): il caricamento è una regione role=status, la card della squadra nella vista
 *  dell'archivio è un pulsante vero, le liste che cambiano tengono la stessa riga per la stessa tappa (chiavi stabili). */
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Loading } from "../../src/components/ui/Loading";
import { ArchivioList } from "../../src/components/archivio/ArchivioList";
import { ArchivioTappaView } from "../../src/components/archivio/ArchivioTappaView";
import { SquadraModal } from "../../src/components/archivio/SquadraModal";
import { focusIniziale } from "../../src/hooks/useFocusFinestra";
import { tappaDiProva } from "./tappeDiProva";
import type { PubTappaMeta, SquadraTappa } from "../../src/types";

afterEach(cleanup); // senza le globali di Vitest, Testing Library non smonta da sola

describe("Loading", () => {
  it("è una regione role=status: il lettore di schermo annuncia che si sta caricando", () => {
    render(<Loading>Sto aprendo l'anagrafe…</Loading>);
    expect(screen.getByRole("status").textContent).toBe("Sto aprendo l'anagrafe…");
  });
});

describe("ArchivioTappaView: le squadre sono pulsanti veri", () => {
  const tappa = tappaDiProva("t1", { Alfa: ["Mario"], Beta: ["Luigi"] }, [{ a: "Alfa", b: "Beta" }]);

  it("nessun div con role=button: ogni squadra è un <button>, raggiungibile con Tab e attivabile con Invio e Spazio dal browser", () => {
    const { container } = render(<ArchivioTappaView t={tappa} />);
    expect(container.querySelector("div[role=button]")).toBeNull();
    const alfa = screen.getByRole("button", { name: /Alfa/ });
    expect(alfa.tagName).toBe("BUTTON");
    expect(alfa.tabIndex).toBe(0);
    expect(alfa.getAttribute("type")).toBe("button");
  });

  it("il nome del pulsante dice la squadra e quanti giocatori ha; il clic apre la scheda della squadra", () => {
    render(<ArchivioTappaView t={tappa} />);
    const alfa = screen.getByRole("button", { name: /Alfa/ });
    expect(alfa.textContent).toContain("1 giocatori");
    fireEvent.click(alfa);
    expect(screen.getByRole("dialog", { name: "Scheda squadra Alfa" })).toBeTruthy();
  });

  it("chiusa la scheda con Esc il focus torna alla card che l'aveva aperta", () => {
    render(<ArchivioTappaView t={tappa} />);
    const beta = screen.getByRole("button", { name: /Beta/ });
    beta.focus();
    fireEvent.click(beta);
    expect(screen.getByRole("dialog", { name: "Scheda squadra Beta" }).contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(beta);
  });
});

describe("ArchivioList: chiavi stabili", () => {
  /** Una voce dell'elenco (la forma sintetica del server), con il nome per riconoscerla */
  const voce = (tappaId: string, nome: string): PubTappaMeta => ({
    tappaId, nome, luogo: "Roma", data: "2025-09-13", nSquadre: 2, lega: "Estate", autore: "Anna", ts: 1,
  });
  const lista = (pubs: PubTappaMeta[]) => <ArchivioList pubs={pubs} errore={null} onRiprova={() => {}} onOpen={() => {}} />;
  /** La riga di una tappa, trovata dal suo nome */
  const riga = (nome: string) => screen.getByText(nome).closest("button")!;

  it("se in testa all'elenco arriva una tappa nuova, ogni riga resta la sua: stesso elemento per la stessa tappa", () => {
    const { rerender } = render(lista([voce("a", "Tappa A"), voce("b", "Tappa B")]));
    const rigaA = riga("Tappa A");
    const rigaB = riga("Tappa B");
    rerender(lista([voce("c", "Tappa C"), voce("a", "Tappa A"), voce("b", "Tappa B")]));
    expect(riga("Tappa A")).toBe(rigaA); // con la chiave = posizione la riga di A sarebbe diventata quella di C
    expect(riga("Tappa B")).toBe(rigaB);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("il clic su una riga apre proprio quella tappa", () => {
    const onOpen = vi.fn();
    const voci = [voce("a", "Tappa A"), voce("b", "Tappa B")];
    render(<ArchivioList pubs={voci} errore={null} onRiprova={() => {}} onOpen={onOpen} />);
    fireEvent.click(within(riga("Tappa B")).getByText("Tappa B"));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(voci[1]);
  });
});

describe("SquadraModal (archivio): il focus iniziale", () => {
  const apri = (squadra: SquadraTappa) => render(<SquadraModal squadra={squadra} hasStats={false} onClose={() => {}} onSelectPlayer={() => {}} />);
  const alfa: SquadraTappa = { id: "s1", nome: "Alfa", rank: "", giocatori: [{ id: "p1", nome: "Mario" }] };

  it("con logo e sito atterra sul blocco dei dati e non sul collegamento: un Invio di riflesso non apre il sito in un'altra scheda", () => {
    apri({ ...alfa, logo: "/logos/alfa.svg", website: "https://alfa.example", instagram: "https://instagram.com/alfa" });
    const blocco = document.querySelector("[data-focus-iniziale]");
    expect(blocco).not.toBeNull();
    expect(document.activeElement).toBe(blocco);
    expect(blocco!.getAttribute("tabindex")).toBe("-1"); // si prende il focus per programma, ma non entra nell'ordine di Tab
    expect(blocco!.textContent).toContain("Mario"); // i dati: è ciò che il lettore di schermo legge all'apertura
    const collegamenti = screen.getAllByRole("link"); // logo, sito e Instagram, raggiungibili con Tab
    expect(collegamenti.length).toBeGreaterThanOrEqual(3);
    expect(collegamenti).not.toContain(document.activeElement);
  });

  it("anche con i soli giocatori (nessun collegamento) il blocco c'è: il roster è un dato", () => {
    apri(alfa);
    const blocco = document.querySelector("[data-focus-iniziale]");
    expect(blocco).not.toBeNull();
    expect(document.activeElement).toBe(blocco);
  });

  it("senza giocatori né logo né collegamenti non c'è un blocco vuoto: il focus va alla finestra stessa", () => {
    apri({ ...alfa, giocatori: [] });
    expect(document.querySelector("[data-focus-iniziale]")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Scheda squadra Alfa" }));
  });

  it("il roster dice «Nessun giocatore registrato.» solo se è vuoto; altrimenti elenca i giocatori", () => {
    apri({ ...alfa, giocatori: [] });
    expect(screen.getByText("Nessun giocatore registrato.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mario" })).toBeNull();
    cleanup();
    apri(alfa);
    expect(screen.queryByText("Nessun giocatore registrato.")).toBeNull();
    expect(screen.getByRole("button", { name: "Mario" })).toBeTruthy();
  });
});

describe("focusIniziale: il blocco dei dati di una scheda prende il focus solo se ha qualcosa da leggere", () => {
  it("con dei dati: tabIndex -1 (si prende per programma, fuori dall'ordine di Tab) e il segno che Modal cerca; senza, niente", () => {
    expect(focusIniziale(true)).toEqual({ tabIndex: -1, "data-focus-iniziale": true });
    expect(focusIniziale(false)).toEqual({});
  });
});
