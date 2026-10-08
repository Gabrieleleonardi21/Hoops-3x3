// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MatchCard } from "../../src/components/partita/MatchCard";
import { useTappa } from "../../src/hooks/useTappa";
import { useAppStore } from "../../src/stores/useAppStore";
import { legheApi } from "../../src/services/legheApi";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { squadraDi } from "../../src/utils/tappaInfo";
import type { Partita, SquadraTappa, Tappa, User } from "../../src/types";

// Si sostituisce solo la rete delle leghe (per l'utente registrato, che salva sul server): scheda, hook, store e coda dei
// salvataggi sono quelli veri
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };
const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

const alfa = (): SquadraTappa => ({
  id: "s1", nome: "Alfa", rank: "",
  giocatori: [{ id: "a1", nome: "Anna" }, { id: "a2", nome: "Bea" }, { id: "a3", nome: "Chiara" }],
});
const beta = (): SquadraTappa => ({
  id: "s2", nome: "Beta", rank: "",
  giocatori: [{ id: "b1", nome: "Dora" }, { id: "b2", nome: "Elsa" }, { id: "b3", nome: "Fede" }],
});

/** Una tappa con un girone da due squadre e una sola partita, `m1`, come `partita` */
const tappa = (partita: Partial<Partita> = {}, squadre: SquadraTappa[] = [alfa(), beta()]): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre, gironi: [["s1", "s2"]], video: [],
  partite: [{ id: "m1", g: 0, a: "s1", b: "s2", sa: 0, sb: 0, done: false, ...partita }],
});

/** Una partita giocata 21-15 con i tabellini: Anna nel formato vecchio (solo il numero dei punti), Bea e Dora nuovo */
const giocata: Partial<Partita> = {
  sa: 21, sb: 15, done: true,
  pa: { a1: 12, a2: { pt: 9 } },
  pb: { b1: { pt: 8, rb: 3 } },
};

/** La scheda della prima partita della tappa, con l'hook vero: com'è nella pagina della tappa (le prop che le dà GironeSection) */
function Scheda() {
  const h = useTappa("t1");
  const m = h.tappa?.partite[0];
  if (!m || !h.tappa) return null;
  return (
    <MatchCard m={m} label="Girone A · Partita 1" guest={!!h.user?.guest} azioni={h.azioniPartita}
      squadraA={squadraDi(h.tappa.squadre, m.a)} squadraB={squadraDi(h.tappa.squadre, m.b)} />
  );
}

/** Mette `t` nello store, per `user`, e mostra la scheda */
function mostra(t: Tappa, user: User = ospite) {
  useAppStore.setState({ user, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [t] });
  render(<Scheda />);
}

/** La partita com'è adesso nello store */
const nelloStore = () => store().tappe[0].partite[0];

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(legheApi.putTappa).mockImplementation(async (t) => t);
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset(); // svuota la coda dei salvataggi
  localStorage.clear();
});

const scrivi = (etichetta: string, testo: string) =>
  fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });
const premi = (nome: string | RegExp) => fireEvent.click(screen.getByRole("button", { name: nome }));
/** Scrive i due punteggi e preme «Salva risultato» */
function salva(punteggioA: string, punteggioB: string) {
  scrivi("Punti Alfa", punteggioA);
  scrivi("Punti Beta", punteggioB);
  premi("Salva risultato");
}

describe("MatchCard: partita da giocare", () => {
  it("mostra le squadre, l'etichetta, i due campi dei punti vuoti e «Salva risultato»", () => {
    mostra(tappa());
    expect(screen.getByText("Girone A · Partita 1")).toBeTruthy();
    expect(screen.getByText("Alfa")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect((screen.getByLabelText("Punti Alfa") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Punti Beta") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Salva risultato" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Correggi" })).toBeNull();
  });

  it("un tabellino per squadra, con i giocatori del roster", () => {
    mostra(tappa());
    expect(screen.getByText(/Statistiche — Alfa/)).toBeTruthy();
    expect(screen.getByText(/Statistiche — Beta/)).toBeTruthy();
    expect(screen.getByLabelText("PT di Anna")).toBeTruthy();
    expect(screen.getByLabelText("PT di Fede")).toBeTruthy();
  });

  it("una squadra senza giocatori con il nome lo dice, nel suo tabellino", () => {
    mostra(tappa({}, [alfa(), { ...beta(), giocatori: [] }]));
    expect(screen.getByText("Nessun giocatore nel roster.")).toBeTruthy();
  });

  it("ospite: i tabellini sono facoltativi", () => {
    mostra(tappa());
    expect(screen.getAllByText(/facoltative da Ospite/)).toHaveLength(2);
  });

  it("registrato: i punti dei giocatori sono obbligatori, il resto facoltativo", () => {
    mostra(tappa(), registrato);
    expect(screen.getAllByText(/punti obbligatori, il resto facoltativo/)).toHaveLength(2);
  });
});

describe("MatchCard: registrare il risultato (ospite, senza tabellino)", () => {
  it("«Salva risultato» registra la partita e la scheda passa alla vista del risultato", () => {
    mostra(tappa());
    salva("21", "15");
    expect(nelloStore()).toMatchObject({ sa: 21, sb: 15, done: true });
    expect(screen.getByText("21")).toBeTruthy(); // i due punteggi sono sulla scheda (chi vince lo fa vedere ScoreCard)
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.queryByLabelText("Punti Alfa")).toBeNull(); // i campi non ci sono più
    expect(screen.queryByRole("button", { name: "Salva risultato" })).toBeNull();
    expect(screen.getByRole("button", { name: "Correggi" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("0 è un punteggio valido", () => {
    mostra(tappa());
    salva("21", "0");
    expect(nelloStore()).toMatchObject({ sa: 21, sb: 0, done: true });
  });

  it("senza tabellini la vista del risultato non ha riepilogo né «Statistiche complete»", () => {
    mostra(tappa());
    salva("21", "15");
    expect(screen.queryByText(/Alfa:/)).toBeNull(); // il riepilogo dei punti per giocatore («Alfa: Anna 10, …»)
    expect(screen.queryByRole("button", { name: /Statistiche complete/ })).toBeNull();
  });
});

describe("MatchCard: punteggio non valido (ospite)", () => {
  // Il messaggio è quello di tappaOps (lo stesso che riceve il Coach); la scheda lo mostra e non salva niente
  const casi: [string, string, string, string][] = [
    ["nessun punteggio", "", "", "Inserisci entrambi i punteggi."],
    ["un solo punteggio", "21", "", "Inserisci entrambi i punteggi."],
    ["un punteggio negativo", "-3", "15", "Inserisci entrambi i punteggi."],
    ["un pareggio", "15", "15", "Nel 3x3 non esistono pareggi: si gioca il supplementare (primo a 2 punti)."],
    ["un punteggio fuori scala", "40", "10", "Punteggio insolito: nel 3x3 la gara finisce a 21 punti (o allo scadere dei 10')."],
  ];

  it.each(casi)("%s: il messaggio compare e la partita resta da giocare", (_nome, a, b, messaggio) => {
    mostra(tappa());
    const prima = store().tappe[0];
    salva(a, b);
    expect(screen.getByRole("alert").textContent).toBe(messaggio);
    expect(store().tappe[0]).toBe(prima);
    expect(screen.getByRole("button", { name: "Salva risultato" })).toBeTruthy();
  });

  // Il limite del fuori scala è il punteggio target + 4 (21 + 4)
  it("25, sul limite del fuori scala, è valido", () => {
    mostra(tappa());
    salva("25", "20");
    expect(nelloStore().done).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("26, appena oltre il limite, no", () => {
    mostra(tappa());
    salva("26", "20");
    expect(screen.getByRole("alert").textContent).toMatch(/^Punteggio insolito/);
    expect(nelloStore().done).toBe(false);
  });

  it("correggendo un punteggio il messaggio sparisce", () => {
    mostra(tappa());
    salva("15", "15");
    expect(screen.getByRole("alert")).toBeTruthy();
    scrivi("Punti Alfa", "21");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un secondo tentativo sbagliato mostra il messaggio nuovo, non quello di prima", () => {
    mostra(tappa());
    salva("15", "15");
    expect(screen.getByRole("alert").textContent).toMatch(/non esistono pareggi/);
    scrivi("Punti Alfa", "");
    premi("Salva risultato");
    expect(screen.getByRole("alert").textContent).toBe("Inserisci entrambi i punteggi.");
  });
});

describe("MatchCard: punti dei giocatori (registrato)", () => {
  /** Scrive i punti (PT) dei giocatori di una squadra, nell'ordine del roster */
  const scriviPunti = (giocatori: string[], punti: string[]) =>
    giocatori.forEach((nome, i) => scrivi(`PT di ${nome}`, punti[i]));

  it("senza i punti dei giocatori il risultato non si salva, e il messaggio dice di quale squadra", () => {
    mostra(tappa(), registrato);
    const prima = store().tappe[0];
    salva("21", "15");
    expect(screen.getByRole("alert").textContent).toBe("Inserisci i punti (PT) di OGNI giocatore di Alfa (anche 0).");
    expect(store().tappe[0]).toBe(prima);
  });

  it("un giocatore senza punti basta a bloccare: ne serve uno per ognuno, anche 0", () => {
    mostra(tappa(), registrato);
    scriviPunti(["Anna", "Bea"], ["21", "0"]); // Chiara manca
    salva("21", "15");
    expect(screen.getByRole("alert").textContent).toMatch(/OGNI giocatore di Alfa/);
  });

  it("i punti che non sommano al totale della squadra sono rifiutati, con i due numeri", () => {
    mostra(tappa(), registrato);
    scriviPunti(["Anna", "Bea", "Chiara"], ["10", "6", "4"]); // 20, non 21
    salva("21", "15");
    expect(screen.getByRole("alert").textContent).toBe("I punti dei giocatori di Alfa sommano 20, ma il totale è 21.");
  });

  it("la seconda squadra si controlla dopo la prima, con il suo nome", () => {
    mostra(tappa(), registrato);
    scriviPunti(["Anna", "Bea", "Chiara"], ["10", "6", "5"]);
    scriviPunti(["Dora", "Elsa", "Fede"], ["8", "4", "4"]); // 16, non 15
    salva("21", "15");
    expect(screen.getByRole("alert").textContent).toBe("I punti dei giocatori di Beta sommano 16, ma il totale è 15.");
  });

  it("una squadra con meno di tre giocatori con il nome non ha un roster valido", () => {
    mostra(tappa({}, [alfa(), { ...beta(), giocatori: [{ id: "b1", nome: "Dora" }, { id: "b2", nome: "Elsa" }] }]), registrato);
    scriviPunti(["Anna", "Bea", "Chiara"], ["10", "6", "5"]);
    salva("21", "15");
    expect(screen.getByRole("alert").textContent).toBe("Beta non ha un roster valido (minimo 3 giocatori).");
  });

  it("il punteggio non valido ha la precedenza: prima si dice del risultato, poi dei punti dei giocatori", () => {
    mostra(tappa(), registrato);
    salva("15", "15");
    expect(screen.getByRole("alert").textContent).toMatch(/non esistono pareggi/);
  });

  it("con i punti giusti per tutte e due le squadre il risultato si salva, con i tabellini in numeri", () => {
    mostra(tappa(), registrato);
    scriviPunti(["Anna", "Bea", "Chiara"], ["10", "6", "5"]);
    scriviPunti(["Dora", "Elsa", "Fede"], ["8", "4", "3"]);
    scrivi("RIMB di Anna", "4"); // una statistica facoltativa
    salva("21", "15");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(nelloStore()).toMatchObject({
      sa: 21, sb: 15, done: true,
      pa: { a1: { pt: 10, rb: 4 }, a2: { pt: 6 }, a3: { pt: 5 } },
      pb: { b1: { pt: 8 }, b2: { pt: 4 }, b3: { pt: 3 } },
    });
  });

  it("l'ospite salva anche senza i punti dei giocatori (prove libere)", () => {
    mostra(tappa());
    salva("21", "15");
    expect(nelloStore().done).toBe(true);
  });
});

describe("MatchCard: partita conclusa", () => {
  it("mostra il risultato senza i campi, con «Correggi» al posto di «Salva risultato»", () => {
    mostra(tappa(giocata));
    expect(screen.getByText("21")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.queryByLabelText("Punti Alfa")).toBeNull();
    expect(screen.queryByText(/Statistiche — Alfa/)).toBeNull(); // niente tabelle di inserimento
    expect(screen.getByRole("button", { name: "Correggi" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salva risultato" })).toBeNull();
  });

  it("riepiloga i punti per giocatore in una riga, anche con il formato vecchio (solo il numero)", () => {
    mostra(tappa(giocata));
    // Anna ha 12 come numero (formato vecchio), Bea e Dora come tabellino; chi non ha il tabellino non compare
    expect(screen.getByText("Alfa: Anna 12, Bea 9 · Beta: Dora 8")).toBeTruthy();
  });

  it("una sola squadra con il tabellino: il riepilogo ha solo quella", () => {
    mostra(tappa({ ...giocata, pb: {} }));
    expect(screen.getByText("Alfa: Anna 12, Bea 9")).toBeTruthy();
  });

  it("«Statistiche complete» apre le tabelle di sola lettura e «Nascondi statistiche» le chiude", () => {
    mostra(tappa(giocata));
    expect(screen.queryByRole("table")).toBeNull();
    premi("Statistiche complete");
    const [tabellaAlfa, tabellaBeta] = screen.getAllByRole("table");
    expect(within(tabellaAlfa).getByText("Anna")).toBeTruthy();
    expect(within(tabellaAlfa).getByText("12")).toBeTruthy(); // il formato vecchio è letto come punti
    expect(within(tabellaAlfa).queryByText("Chiara")).toBeNull(); // senza tabellino non c'è la riga
    expect(within(tabellaBeta).getByText("Dora")).toBeTruthy();
    expect(within(tabellaBeta).getByText("3")).toBeTruthy(); // i rimbalzi di Dora
    expect(within(tabellaBeta).getAllByText("—").length).toBeGreaterThan(0); // le statistiche che mancano
    premi("Nascondi statistiche");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Statistiche complete" })).toBeTruthy();
  });

  it("«Correggi» riapre la partita: i campi tornano con il risultato e con i tabellini come bozza", () => {
    mostra(tappa(giocata));
    premi("Correggi");
    expect(nelloStore().done).toBe(false);
    expect((screen.getByLabelText("Punti Alfa") as HTMLInputElement).value).toBe("21");
    expect((screen.getByLabelText("Punti Beta") as HTMLInputElement).value).toBe("15");
    expect((screen.getByLabelText("PT di Anna") as HTMLInputElement).value).toBe("12"); // dal formato vecchio
    expect((screen.getByLabelText("RIMB di Dora") as HTMLInputElement).value).toBe("3");
    expect(screen.getByRole("button", { name: "Salva risultato" })).toBeTruthy();
  });

  it("corretto il punteggio, il nuovo risultato sostituisce il vecchio", () => {
    mostra(tappa(giocata));
    premi("Correggi");
    scrivi("Punti Beta", "19");
    premi("Salva risultato");
    expect(nelloStore()).toMatchObject({ sa: 21, sb: 19, done: true });
    expect(screen.getByText("19")).toBeTruthy();
  });
});

describe("MatchCard: eventi di gara", () => {
  it("chiusi all'inizio, con il numero sul pulsante; si aprono con il suggerimento e il modulo", () => {
    mostra(tappa());
    expect(screen.queryByText(/Registra falli, sostituzioni/)).toBeNull();
    premi("Eventi di gara (0)");
    expect(screen.getByText(/Registra falli, sostituzioni/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aggiungi" })).toBeTruthy();
    premi("Nascondi eventi");
    expect(screen.queryByRole("button", { name: "Aggiungi" })).toBeNull();
  });

  it("«Aggiungi» registra l'evento sulla partita, lo mostra nell'elenco e svuota minuto e nota", () => {
    mostra(tappa());
    premi("Eventi di gara (0)");
    fireEvent.change(screen.getByLabelText("Giocatore"), { target: { value: "a1" } });
    scrivi("Minuto", "7");
    scrivi("Nota", "gomito alto");
    premi("Aggiungi");
    expect(nelloStore().eventi).toMatchObject([{ tipo: "Fallo", teamId: "s1", pid: "a1", min: "7", nota: "gomito alto" }]);
    expect(screen.getByText("Alfa — Anna · gomito alto")).toBeTruthy();
    expect(screen.getByText("7'")).toBeTruthy();
    expect(screen.queryByText(/Registra falli, sostituzioni/)).toBeNull(); // con un evento il suggerimento non serve più
    expect((screen.getByLabelText("Minuto") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nota") as HTMLInputElement).value).toBe("");
  });

  it("l'evento di una squadra: cambiando squadra i giocatori da scegliere sono i suoi", () => {
    mostra(tappa());
    premi("Eventi di gara (0)");
    const giocatori = () => within(screen.getByLabelText("Giocatore")).getAllByRole("option").map((o) => o.textContent);
    expect(giocatori()).toEqual(["—", "Anna", "Bea", "Chiara"]);
    fireEvent.change(screen.getByLabelText("Squadra"), { target: { value: "b" } });
    expect(giocatori()).toEqual(["—", "Dora", "Elsa", "Fede"]);
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "Timeout" } });
    premi("Aggiungi");
    expect(nelloStore().eventi).toMatchObject([{ tipo: "Timeout", teamId: "s2", pid: null }]);
  });

  it("il pulsante conta gli eventi, e «Rimuovi evento» ne toglie uno", () => {
    mostra(tappa({ eventi: [
      { id: "e1", tipo: "Fallo", teamId: "s1", pid: "a1", min: "3", nota: "" },
      { id: "e2", tipo: "Timeout", teamId: "s2", pid: null, min: "", nota: "" },
    ] }));
    premi("Eventi di gara (2)");
    expect(screen.getAllByRole("button", { name: "Rimuovi evento" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Rimuovi evento" })[0]);
    expect(nelloStore().eventi?.map((e) => e.id)).toEqual(["e2"]);
    premi("Nascondi eventi");
    expect(screen.getByRole("button", { name: "Eventi di gara (1)" })).toBeTruthy();
  });

  it("anche una partita conclusa ha gli eventi", () => {
    mostra(tappa(giocata));
    premi("Eventi di gara (0)");
    expect(screen.getByRole("button", { name: "Aggiungi" })).toBeTruthy();
  });
});
