// @vitest-environment jsdom
/** Il timer di gara: usa le regole della tappa, calcola i cronometri dall'orologio (non dal numero di scatti) e gestisce il
 *  supplementare. Con il tempo finto (fake timers) si simula ciò che succede con la scheda in secondo piano o il telefono
 *  bloccato: gli scatti rallentano o non arrivano, l'orologio no. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MatchTimer } from "../../src/components/partita/MatchTimer";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Regole } from "../../src/types";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.useRealTimers();
  document.body.style.overflow = "";
});

function apri(regole: Regole = DEFAULT_RULES) {
  return render(<MatchTimer regole={regole} onClose={() => {}} />);
}

/** Fa passare `ms` di orologio con tutti gli scatti: la scheda è in primo piano */
const passa = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Fa passare `ms` di orologio senza nessuno scatto: la scheda è in secondo piano o il telefono è bloccato, e i timer del browser
 *  si fermano o rallentano (setSystemTime sposta l'orologio senza far scattare i timer) */
const passaSenzaScatti = (ms: number) => vi.setSystemTime(Date.now() + ms);

const premi = (nome: string) => fireEvent.click(screen.getByRole("button", { name: nome }));
const mostra = (testo: string) => screen.getByText(testo);
const manca = (testo: string | RegExp) => expect(screen.queryByText(testo)).toBeNull();
/** Il cronometro di gara com'è scritto adesso: l'unico testo nella forma m:ss */
const cronometro = () => screen.getByText(/^\d+:\d{2}$/).textContent;

const A = 0;
const B = 1;
/** Segna `pt` punti alla squadra A o B: i pulsanti «+1» e «+2» sono in ordine A, B */
const segna = (squadra: typeof A | typeof B, pt: "+1" | "+2") => fireEvent.click(screen.getAllByRole("button", { name: pt })[squadra]);

/** Un minuto di gara: con 60 secondi si arriva allo scadere senza far girare 600 secondi di scatti */
const BREVE: Regole = { ...DEFAULT_RULES, durata: 1 };
const scadere = () => passa(60_000);

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

describe("MatchTimer: usa le regole della tappa", () => {
  const REGOLE_DELLA_TAPPA: Regole = { target: 11, durata: 5, ot: 3, shot: 24 };

  it("parte con la durata e il possesso della tappa, non con 10 minuti e 12 secondi", () => {
    apri(REGOLE_DELLA_TAPPA);
    expect(cronometro()).toBe("5:00");
    expect(mostra("24")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset 24s" })).toBeTruthy();
  });

  it("il possesso ricomincia dai secondi della tappa", () => {
    apri(REGOLE_DELLA_TAPPA);
    premi("START");
    passa(26_000); // 24 secondi, poi ne passano 2 del ciclo dopo
    expect(mostra("22")).toBeTruthy();
  });

  it("la partita finisce al punteggio di vittoria della tappa, non a 21", () => {
    apri(REGOLE_DELLA_TAPPA);
    for (let i = 0; i < 5; i++) segna(A, "+2"); // 10 punti: ne manca ancora uno
    manca(/Partita conclusa/);
    segna(A, "+1"); // 11
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
  });

  it("il supplementare dice quanti punti servono secondo la tappa", () => {
    apri({ ...REGOLE_DELLA_TAPPA, durata: 1 });
    segna(A, "+2");
    segna(B, "+2");
    premi("START");
    scadere();
    expect(mostra("Supplementare: vince chi segna per primo 3 pt")).toBeTruthy();
  });

  it("con il possesso a 0 (dati vecchi dell'ospite) il timer non si rompe: vale almeno 1 secondo", () => {
    apri({ ...DEFAULT_RULES, shot: 0 });
    premi("START");
    passa(2500);
    manca(/NaN/);
    expect(mostra("1")).toBeTruthy();
  });
});

describe("MatchTimer: la partita si decide", () => {
  const ATRE: Regole = { ...DEFAULT_RULES, target: 3 };

  it("a tempo scaduto vince chi è avanti, e «OT» e «Partita conclusa» non compaiono insieme", () => {
    apri(BREVE);
    segna(A, "+2");
    premi("START");
    scadere();
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
    expect(cronometro()).toBe("0:00");
    manca("OT");
    expect(screen.queryByRole("button", { name: "START" })).toBeNull();
  });

  it("vince anche la squadra B, se è avanti", () => {
    apri(BREVE);
    segna(A, "+1");
    segna(B, "+2");
    premi("START");
    scadere();
    expect(mostra("Squadra B — Partita conclusa")).toBeTruthy();
  });

  it("in parità a tempo scaduto parte il supplementare: «OT», niente «Partita conclusa», e si può avviare", () => {
    apri(BREVE);
    segna(A, "+1");
    segna(B, "+1");
    premi("START");
    scadere();
    expect(mostra("OT")).toBeTruthy();
    expect(mostra("Supplementare: vince chi segna per primo 2 pt")).toBeTruthy();
    manca(/Partita conclusa/);
    expect(screen.getByRole("button", { name: "START" })).toBeTruthy();
  });

  it("nel supplementare vince chi segna per primo i punti previsti, contati da quando il supplementare parte", () => {
    apri({ ...BREVE, ot: 3 });
    segna(A, "+2");
    segna(A, "+2");
    segna(B, "+2");
    segna(B, "+2"); // 4 pari
    premi("START");
    scadere();
    segna(A, "+2"); // 2 punti del supplementare: con 3 da fare non basta, anche se il totale è già 6
    manca(/Partita conclusa/);
    segna(B, "+2"); // 2 pari nel supplementare
    manca(/Partita conclusa/);
    segna(A, "+1"); // il terzo punto di A, per primo
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
  });

  it("nel supplementare il punteggio di vittoria non vale più: servono comunque i punti del supplementare", () => {
    apri({ ...BREVE, target: 3 });
    segna(A, "+2");
    segna(B, "+2");
    premi("START");
    scadere();
    segna(A, "+1"); // 3 a 2: A è al punteggio di vittoria, ma nel supplementare ha fatto un punto solo
    manca(/Partita conclusa/);
    segna(A, "+1");
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
  });

  it("una correzione prima del primo punto del supplementare corregge il tempo regolamentare: il supplementare non è ancora partito", () => {
    apri(BREVE);
    segna(A, "+1");
    segna(B, "+1");
    premi("START");
    scadere(); // 1 pari: supplementare
    fireEvent.click(screen.getByRole("button", { name: "Togli un punto a Squadra A" })); // A non aveva segnato: 0 a 1
    expect(mostra("Squadra B — Partita conclusa")).toBeTruthy();
    segna(A, "+1"); // di nuovo 1 pari: supplementare
    manca(/Partita conclusa/);
    segna(A, "+1"); // il primo punto del supplementare (2 a 1)
    manca(/Partita conclusa/);
    segna(A, "+1"); // il secondo: A vince
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
  });

  it("togliere il primo punto del supplementare lo riporta a prima che partisse: una correzione dopo conta ancora sul tempo regolamentare", () => {
    apri(BREVE);
    segna(A, "+1");
    segna(B, "+1");
    premi("START");
    scadere(); // 1 pari: supplementare
    segna(A, "+1"); // 2 a 1: il primo punto del supplementare
    fireEvent.click(screen.getByRole("button", { name: "Togli un punto a Squadra A" })); // sbagliato: di nuovo 1 pari
    manca(/Partita conclusa/);
    fireEvent.click(screen.getByRole("button", { name: "Togli un punto a Squadra B" })); // anche B non aveva segnato: 1 a 0
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
  });

  it("nel supplementare «START» fa correre solo il possesso: al posto del tempo resta «OT»", () => {
    apri(BREVE);
    segna(A, "+1");
    segna(B, "+1");
    premi("START");
    scadere();
    premi("START");
    passa(5000);
    expect(mostra("OT")).toBeTruthy();
    expect(mostra("7")).toBeTruthy(); // il possesso: 12 meno 5
    premi("STOP");
    passa(10_000);
    expect(mostra("7")).toBeTruthy();
  });

  it("al punteggio di vittoria i cronometri si fermano", () => {
    apri(ATRE);
    premi("START");
    passa(10_000);
    segna(A, "+2");
    segna(A, "+1");
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
    expect(cronometro()).toBe("9:50");
    passa(30_000);
    expect(cronometro()).toBe("9:50");
  });

  it("togliere un punto riapre una partita decisa per errore", () => {
    apri(ATRE);
    segna(A, "+2");
    segna(A, "+1");
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Togli un punto a Squadra A" }));
    manca(/Partita conclusa/);
    expect(screen.getByRole("button", { name: "START" })).toBeTruthy();
  });

  it("«Reset tutto» riporta punteggio e cronometri all'inizio e dimentica il supplementare di prima", () => {
    apri(BREVE);
    segna(A, "+1");
    segna(B, "+1");
    premi("START");
    scadere();
    segna(A, "+2");
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();

    premi("Reset tutto");
    expect(cronometro()).toBe("1:00");
    expect(screen.getAllByText("0")).toHaveLength(2);
    manca(/Partita conclusa/);
    // Una seconda partita: 0 a 0 allo scadere, e il supplementare riparte da capo (non dall'1 pari di prima)
    premi("START");
    scadere();
    expect(mostra("OT")).toBeTruthy();
    segna(A, "+1");
    manca(/Partita conclusa/);
    segna(A, "+1");
    expect(mostra("Squadra A — Partita conclusa")).toBeTruthy();
  });
});

describe("MatchTimer: è una finestra come le altre (Modal)", () => {
  it("ha il suo nome: «Timer di gara»", () => {
    apri();
    expect(screen.getByRole("dialog", { name: "Timer di gara" })).toBeTruthy();
  });

  it("si chiude con Esc e con la X, come le altre finestre", () => {
    const onClose = vi.fn();
    render(<MatchTimer regole={DEFAULT_RULES} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("usare i pulsanti del timer non lo chiude", () => {
    const onClose = vi.fn();
    render(<MatchTimer regole={DEFAULT_RULES} onClose={onClose} />);
    segna(A, "+2");
    premi("START");
    premi("STOP");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("blocca lo scorrimento della pagina finché è aperto, e lo rimette alla chiusura", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = apri();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });
});
