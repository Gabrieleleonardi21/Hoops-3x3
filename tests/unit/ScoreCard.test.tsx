// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ScoreCard } from "../../src/components/partita/ScoreCard";

afterEach(cleanup); // senza le globali di Vitest, Testing Library non smonta da sola

const alfa = { name: "Alfa" };
const beta = { name: "Beta", sub: "Roma" };

/** La classe del testo dell'etichetta nell'intestazione: c'è solo se l'intestazione c'è */
const CLASSE_ETICHETTA = ".kicker";

/** Il punteggio che si legge con questo testo è seguito da «vince» (testo per i lettori di schermo): chi ha vinto non si
 *  riconosce solo dal colore */
const vince = (testo: string) => screen.getByText(testo).nextElementSibling?.textContent === "vince";

describe("ScoreCard: chi ha vinto", () => {
  it("a partita conclusa «vince» segue il punteggio più alto e non l'altro (vince A)", () => {
    render(<ScoreCard a={alfa} b={beta} sa={21} sb={15} done />);
    expect(vince("21")).toBe(true);
    expect(vince("15")).toBe(false);
    expect(screen.getAllByText("vince")).toHaveLength(1);
  });

  it("vale anche quando vince B", () => {
    render(<ScoreCard a={alfa} b={beta} sa={12} sb={21} done />);
    expect(vince("12")).toBe(false);
    expect(vince("21")).toBe(true);
  });

  it("senza «done» (partita in corso) nessuno dei due vince, nemmeno se un punteggio è più alto", () => {
    render(<ScoreCard a={alfa} b={beta} sa={8} sb={5} />);
    expect(screen.queryByText("vince")).toBeNull();
  });

  it("conclusa ma con un punteggio mancante non c'è un vincitore", () => {
    render(<ScoreCard a={alfa} b={beta} sa={21} sb={null} done />);
    expect(screen.queryByText("vince")).toBeNull();
  });

  it("un punteggio a zero è un punteggio: 21 a 0 ha il suo vincitore e il suo perdente, e lo 0 si vede", () => {
    render(<ScoreCard a={alfa} b={beta} sa={21} sb={0} done />);
    expect(vince("21")).toBe(true);
    expect(vince("0")).toBe(false);
  });

  /* L'unico test legato ai token di colore, come documentazione del design system: chi vince lo dice il testo «vince» (sopra),
   * qui si fissa solo come lo si vede (text-chalk non è text-chalk-dim). Se i token cambiano si cambia questo test e nessun altro */
  it("stile: a partita conclusa il punteggio di chi vince è in chalk e quello di chi perde attenuato; in corso tutti e due neutri", () => {
    const { unmount } = render(<ScoreCard a={alfa} b={beta} sa={21} sb={15} done />);
    expect(screen.getByText("21").classList.contains("text-chalk")).toBe(true);
    expect(screen.getByText("15").classList.contains("text-chalk-dim")).toBe(true);
    unmount();
    render(<ScoreCard a={alfa} b={beta} sa={8} sb={5} />);
    expect(screen.getByText("8").classList.contains("text-chalk-muted")).toBe(true);
    expect(screen.getByText("5").classList.contains("text-chalk-muted")).toBe(true);
  });
});

describe("ScoreCard: partita non giocata e slot centrale", () => {
  it("senza punteggi mostra un trattino per ciascuno e uno al centro", () => {
    render(<ScoreCard a={alfa} b={beta} />);
    expect(screen.getAllByText("–")).toHaveLength(3);
  });

  it("con uno slot centrale (i campi dei punti) e senza punteggi mostra solo lo slot, senza trattini", () => {
    render(<ScoreCard a={alfa} b={beta} center={<input aria-label="Punti Alfa" />} />);
    expect(screen.getByLabelText("Punti Alfa")).toBeTruthy();
    expect(screen.queryByText("–")).toBeNull();
  });

  it("con lo slot e i punteggi mostra i punteggi ai due lati dello slot", () => {
    render(<ScoreCard a={alfa} b={beta} sa={4} sb={2} center={<span>vs</span>} />);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("vs")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});

describe("ScoreCard: intestazione, nomi e piede", () => {
  it("mostra i nomi delle squadre e la scritta sotto il nome, se c'è", () => {
    render(<ScoreCard a={alfa} b={beta} />);
    expect(screen.getByText("Alfa")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Roma")).toBeTruthy();
  });

  it("senza etichetta e senza «live» non c'è intestazione", () => {
    render(<ScoreCard a={alfa} b={beta} />);
    expect(screen.queryByText("Live")).toBeNull();
    expect(document.querySelector(CLASSE_ETICHETTA)).toBeNull();
  });

  it("l'etichetta compare nell'intestazione, e «live» aggiunge il segno Live", () => {
    render(<ScoreCard a={alfa} b={beta} label="Semifinale 1" live />);
    expect(screen.getByText("Semifinale 1")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("il piede (azioni, eventi) compare sotto i punteggi solo se c'è", () => {
    const { rerender } = render(<ScoreCard a={alfa} b={beta} />);
    expect(screen.queryByText("Azioni")).toBeNull();
    rerender(<ScoreCard a={alfa} b={beta} footer={<p>Azioni</p>} />);
    expect(screen.getByText("Azioni")).toBeTruthy();
  });
});
