// @vitest-environment jsdom
/** Il timer di gara: i cronometri si calcolano dall'orologio e non dal numero di scatti. Con il tempo finto (fake timers) si
 *  simula ciò che succede con la scheda in secondo piano o il telefono bloccato: gli scatti rallentano o non arrivano, l'orologio no. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MatchTimer } from "../../src/components/partita/MatchTimer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.useRealTimers();
});

function apri() {
  return render(<MatchTimer onClose={() => {}} />);
}

/** Fa passare `ms` di orologio con tutti gli scatti: la scheda è in primo piano */
const passa = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Fa passare `ms` di orologio senza nessuno scatto: la scheda è in secondo piano o il telefono è bloccato, e i timer del browser
 *  si fermano o rallentano (setSystemTime sposta l'orologio senza far scattare i timer) */
const passaSenzaScatti = (ms: number) => vi.setSystemTime(Date.now() + ms);

const premi = (nome: string) => fireEvent.click(screen.getByRole("button", { name: nome }));
const mostra = (testo: string) => screen.getByText(testo);
/** Il cronometro di gara com'è scritto adesso: l'unico testo nella forma m:ss */
const cronometro = () => screen.getByText(/^\d+:\d{2}$/).textContent;

describe("MatchTimer: il tempo si calcola dall'orologio, non dagli scatti", () => {
  it("dopo 30 secondi senza scatti il cronometro di gara mostra il valore giusto", () => {
    apri();
    premi("START");
    passaSenzaScatti(30_000);
    passa(1000); // al ritorno in primo piano arriva uno scatto: sono passati 31 secondi in tutto
    expect(cronometro()).toBe("9:29");
  });

  it("vale anche per il possesso: dopo 30 secondi senza scatti segna il punto giusto del suo ciclo", () => {
    apri();
    premi("START");
    passaSenzaScatti(30_000);
    passa(1000);
    // 31 secondi con il possesso che ricomincia da 12 ogni volta che scade: 12 + 12 + 7, ne mancano 5
    expect(mostra("5")).toBeTruthy();
  });

  it("in pausa il cronometro tiene il valore, per quanto tempo passi, e riparte da lì", () => {
    apri();
    premi("START");
    passa(5000);
    expect(cronometro()).toBe("9:55");
    premi("STOP");
    passaSenzaScatti(30_000);
    passa(30_000);
    expect(cronometro()).toBe("9:55");
    premi("START");
    passa(5000);
    expect(cronometro()).toBe("9:50");
  });

  it("«Reset 12s» fa ripartire il possesso da un secondo intero, non dal prossimo scatto", () => {
    apri();
    premi("START");
    passa(7500); // al possesso mancano 4,5 secondi
    premi("Reset 12s");
    passa(600); // dal reset non è passato un secondo intero: il possesso è ancora a 12
    expect(mostra("12")).toBeTruthy();
    passa(500); // ora sì
    expect(mostra("11")).toBeTruthy();
  });

  it("il possesso scaduto ricomincia da capo da solo, e il cronometro di gara continua", () => {
    apri();
    premi("START");
    passa(13_000);
    expect(mostra("11")).toBeTruthy();
    expect(cronometro()).toBe("9:47");
  });

  it("un tempo scaduto durante gli scatti mancati si vede al primo scatto, e i cronometri si fermano nell'istante della scadenza", () => {
    apri();
    premi("START");
    passaSenzaScatti(601_400);
    passa(100); // primo scatto: il tempo è scaduto da 1,5 secondi
    expect(screen.queryByRole("button", { name: "STOP" })).toBeNull();
    // Il possesso è fermo a com'era alla scadenza (12, dopo 50 cicli esatti), non a com'era allo scatto (10,5), per quanto tempo passi
    passa(30_000);
    expect(mostra("12")).toBeTruthy();
  });

  it("chiuso mentre i cronometri corrono, non lascia scatti in giro", () => {
    const { unmount } = apri();
    premi("START");
    passa(2000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
