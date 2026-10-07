// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ScoreCard } from "../../src/components/partita/ScoreCard";

afterEach(cleanup); // senza le globali di Vitest, Testing Library non smonta da sola

const alfa = { name: "Alfa" };
const beta = { name: "Beta", sub: "Roma" };

/** Il colore è l'unico segno visibile di chi ha vinto: si guarda la classe esatta (text-chalk non è text-chalk-dim) */
const tono = (testo: string) => {
  const classi = screen.getByText(testo).classList;
  if (classi.contains("text-chalk")) return "vincitore";
  if (classi.contains("text-chalk-dim")) return "perdente";
  if (classi.contains("text-chalk-muted")) return "neutro";
  return "altro";
};

describe("ScoreCard: chi ha vinto", () => {
  it("a partita conclusa il punteggio più alto è in evidenza e l'altro attenuato (vince A)", () => {
    render(<ScoreCard a={alfa} b={beta} sa={21} sb={15} done />);
    expect(tono("21")).toBe("vincitore");
    expect(tono("15")).toBe("perdente");
  });

  it("vale anche quando vince B", () => {
    render(<ScoreCard a={alfa} b={beta} sa={12} sb={21} done />);
    expect(tono("12")).toBe("perdente");
    expect(tono("21")).toBe("vincitore");
  });

  it("senza «done» (partita in corso) nessuno dei due è in evidenza, nemmeno se un punteggio è più alto", () => {
    render(<ScoreCard a={alfa} b={beta} sa={8} sb={5} />);
    expect(tono("8")).toBe("neutro");
    expect(tono("5")).toBe("neutro");
  });

  it("conclusa ma con un punteggio mancante non c'è un vincitore", () => {
    render(<ScoreCard a={alfa} b={beta} sa={21} sb={null} done />);
    expect(tono("21")).toBe("neutro");
  });

  it("un punteggio a zero è un punteggio: 21 a 0 ha il suo vincitore e il suo perdente, e lo 0 si vede", () => {
    render(<ScoreCard a={alfa} b={beta} sa={21} sb={0} done />);
    expect(tono("21")).toBe("vincitore");
    expect(tono("0")).toBe("perdente");
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
    expect(document.querySelector(".kicker")).toBeNull();
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
