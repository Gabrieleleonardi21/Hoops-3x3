// @vitest-environment jsdom
/** Accessibilità dei componenti di base (T2.13): il caricamento è una regione role=status, la card della squadra nella vista
 *  dell'archivio è un pulsante vero, le liste che cambiano tengono la stessa riga per la stessa tappa (chiavi stabili). */
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Loading } from "../../src/components/ui/Loading";
import { ArchivioList } from "../../src/components/archivio/ArchivioList";
import { ArchivioTappaView } from "../../src/components/archivio/ArchivioTappaView";
import { tappaDiProva } from "./tappeDiProva";
import type { PubTappa } from "../../src/types";

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
  /** Una tappa pubblicata, con il nome per riconoscerla */
  const pub = (id: string, nome: string): PubTappa => ({
    tappa: { ...tappaDiProva(id, { Alfa: ["Mario"], Beta: ["Luigi"] }, []), nome },
    lega: "Estate", autore: "Anna", autoreId: "u1", ts: 1,
  });
  const lista = (pubs: PubTappa[]) => <ArchivioList pubs={pubs} errore={null} onRiprova={() => {}} onOpen={() => {}} />;
  /** La riga di una tappa, trovata dal suo nome */
  const riga = (nome: string) => screen.getByText(nome).closest("button")!;

  it("se in testa all'elenco arriva una tappa nuova, ogni riga resta la sua: stesso elemento per la stessa tappa", () => {
    const { rerender } = render(lista([pub("a", "Tappa A"), pub("b", "Tappa B")]));
    const rigaA = riga("Tappa A");
    const rigaB = riga("Tappa B");
    rerender(lista([pub("c", "Tappa C"), pub("a", "Tappa A"), pub("b", "Tappa B")]));
    expect(riga("Tappa A")).toBe(rigaA); // con la chiave = posizione la riga di A sarebbe diventata quella di C
    expect(riga("Tappa B")).toBe(rigaB);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("il clic su una riga apre proprio quella tappa", () => {
    const onOpen = vi.fn();
    const pubs = [pub("a", "Tappa A"), pub("b", "Tappa B")];
    render(<ArchivioList pubs={pubs} errore={null} onRiprova={() => {}} onOpen={onOpen} />);
    fireEvent.click(within(riga("Tappa B")).getByText("Tappa B"));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(pubs[1]);
  });
});
