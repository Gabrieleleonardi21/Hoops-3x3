// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BracketSection } from "../../src/components/gironi/BracketSection";
import { useAppStore } from "../../src/stores/useAppStore";
import { generaFasiDirette, registraRisultatoBracket } from "../../src/domain/tappaOps";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };

/** Quattro squadre, due gironi già conclusi (Alfa batte Delta, Gamma batte Beta), nessun tabellone */
const tappaGironiConclusi = (): Tappa => ({
  id: "t1", nome: "Roma Open", luogo: "", data: "", nGironi: 2, regole: { ...DEFAULT_RULES },
  squadre: [
    { id: "a", nome: "Alfa", giocatori: [], rank: 40 },
    { id: "b", nome: "Beta", giocatori: [], rank: 30 },
    { id: "c", nome: "Gamma", giocatori: [], rank: 20 },
    { id: "d", nome: "Delta", giocatori: [], rank: 10 },
  ],
  gironi: [["a", "d"], ["b", "c"]],
  partite: [
    { id: "m1", g: 0, a: "a", b: "d", sa: 21, sb: 15, done: true },
    { id: "m2", g: 1, a: "b", b: "c", sa: 18, sb: 21, done: true },
  ],
  video: [],
});

/** La stessa tappa con il tabellone già generato (due semifinali e la finale, ancora da giocare) */
function tappaConTabellone(): Tappa {
  const esito = generaFasiDirette(tappaGironiConclusi());
  if (!esito.ok) throw new Error(esito.errore);
  return esito.tappa;
}

/** La tappa com'è adesso nello store */
const nelloStore = () => store().tappe[0];

/** Mostra BracketSection con la tappa `vista` e mette nello store `inStore`. La sezione non si aggiorna: come un
 *  componente che ha letto la tappa prima che cambiasse qualcosa, e il clic arriva dopo. */
function mostra(vista: Tappa, inStore: Tappa = vista) {
  useAppStore.setState({ user: ospite, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [inStore] });
  render(<BracketSection tappa={vista} />);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  localStorage.clear();
});

describe("BracketSection: le operazioni partono dalla tappa com'è adesso nello store", () => {
  it("«Genera bracket» non cancella ciò che è cambiato dopo che la sezione ha letto la tappa", () => {
    mostra(tappaGironiConclusi());
    act(() => { store().updateTappa("t1", { luogo: "Roma" }); }); // un'altra modifica, mentre la sezione resta com'era
    fireEvent.click(screen.getByRole("button", { name: "Genera bracket eliminazione diretta" }));
    expect(nelloStore().bracket).toHaveLength(3);
    expect(nelloStore().luogo).toBe("Roma");
  });

  it("«Salva» di un match non cancella ciò che è cambiato dopo che la sezione ha letto la tappa", () => {
    mostra(tappaConTabellone());
    act(() => { store().updateTappa("t1", { luogo: "Roma" }); });
    const [puntiA, puntiB] = screen.getAllByRole("spinbutton"); // i campi della prima semifinale
    fireEvent.change(puntiA, { target: { value: "21" } });
    fireEvent.change(puntiB, { target: { value: "15" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Salva" })[0]);
    expect(nelloStore().bracket?.[0]).toMatchObject({ pA: 21, pB: 15, done: true });
    expect(nelloStore().luogo).toBe("Roma");
  });

  it("un risultato registrato altrove resta, e i due vincitori arrivano in finale", () => {
    // La sezione ha ancora le due semifinali da giocare; nello store la prima è già registrata (per esempio dal Coach)
    const vista = tappaConTabellone();
    const esito = registraRisultatoBracket(vista, vista.bracket?.[0].id ?? "", 21, 15);
    if (!esito.ok) throw new Error(esito.errore);
    mostra(vista, esito.tappa);
    const [, , puntiA, puntiB] = screen.getAllByRole("spinbutton"); // campi della seconda semifinale
    fireEvent.change(puntiA, { target: { value: "21" } });
    fireEvent.change(puntiB, { target: { value: "10" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Salva" })[1]);
    const [prima, seconda, finale] = nelloStore().bracket ?? [];
    expect([prima.done, seconda.done]).toEqual([true, true]);
    expect(finale.squadraA).not.toBeNull();
    expect(finale.squadraB).not.toBeNull();
  });

  it("un punteggio non valido non cambia niente", () => {
    mostra(tappaConTabellone());
    const prima = nelloStore();
    const [puntiA, puntiB] = screen.getAllByRole("spinbutton");
    fireEvent.change(puntiA, { target: { value: "15" } });
    fireEvent.change(puntiB, { target: { value: "15" } }); // pareggio: nel 3x3 non esiste
    fireEvent.click(screen.getAllByRole("button", { name: "Salva" })[0]);
    expect(nelloStore()).toBe(prima);
  });
});

describe("BracketSection: punteggio non valido (R4)", () => {
  it("sonda: «Salva» con un punteggio non valido mostra il messaggio di registraRisultatoBracket", () => {
    mostra(tappaConTabellone());
    const [puntiA, puntiB] = screen.getAllByRole("spinbutton");
    fireEvent.change(puntiA, { target: { value: "15" } });
    fireEvent.change(puntiB, { target: { value: "15" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Salva" })[0]);
    expect(screen.getByRole("alert").textContent).toBe("Nel 3x3 non esistono pareggi: si gioca il supplementare (primo a 2 punti).");
  });

  it("senza punteggio dice di inserirlo; il messaggio sparisce quando si corregge", () => {
    mostra(tappaConTabellone());
    fireEvent.click(screen.getAllByRole("button", { name: "Salva" })[0]);
    expect(screen.getByRole("alert").textContent).toBe("Inserisci entrambi i punteggi.");
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "21" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("BracketSection: «Correggi» di un risultato del tabellone", () => {
  /** Il tabellone con la prima semifinale già giocata (21-15) */
  function conPrimaSemifinale(): Tappa {
    const t = tappaConTabellone();
    const esito = registraRisultatoBracket(t, t.bracket?.[0].id ?? "", 21, 15);
    if (!esito.ok) throw new Error(esito.errore);
    return esito.tappa;
  }

  it("riporta il match da giocare, toglie il vincitore dalla finale e rimette i punteggi nei campi", () => {
    mostra(conPrimaSemifinale());
    fireEvent.click(screen.getByRole("button", { name: "Correggi" }));
    const [prima, , finale] = nelloStore().bracket ?? [];
    expect(prima.done).toBe(false);
    expect([finale.squadraA, finale.squadraB]).toEqual([null, null]);
  });

  it("i punteggi annullati restano nei campi come bozza", () => {
    const t = conPrimaSemifinale();
    useAppStore.setState({ user: ospite, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 1 }], tappe: [t] });
    const { rerender } = render(<BracketSection tappa={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Correggi" }));
    rerender(<BracketSection tappa={nelloStore()} />);
    const [puntiA, puntiB] = screen.getAllByRole("spinbutton");
    expect([(puntiA as HTMLInputElement).value, (puntiB as HTMLInputElement).value]).toEqual(["21", "15"]);
  });

  it("se il vincitore ha già giocato il turno dopo, il risultato resta e si dice perché", () => {
    let t = conPrimaSemifinale();
    for (const [id, a, b] of [[t.bracket?.[1].id ?? "", 21, 10], [t.bracket?.[2].id ?? "", 21, 19]] as const) {
      const esito = registraRisultatoBracket(t, id, a, b);
      if (!esito.ok) throw new Error(esito.errore);
      t = esito.tappa;
    }
    mostra(t);
    fireEvent.click(screen.getAllByRole("button", { name: "Correggi" })[0]);
    expect(screen.getByRole("alert").textContent).toBe("Finale: è già stata giocata. Annulla prima quel risultato.");
    expect(nelloStore()).toBe(t);
  });
});

describe("BracketSection: «Elimina bracket e ricomincia» chiede conferma (FD-2)", () => {
  const elimina = () => screen.getByRole("button", { name: "Elimina bracket e ricomincia" });

  it("apre la finestra e dice che cosa si perde; finché non si risponde il tabellone c'è", () => {
    mostra(tappaConTabellone());
    fireEvent.click(elimina());
    expect(screen.getByRole("alertdialog", { name: "Eliminare il tabellone?" }).textContent)
      .toContain("Verrà eliminato il tabellone. I risultati dei gironi restano.");
    expect(nelloStore().bracket).toHaveLength(3);
  });

  it("i risultati si contano sulla tappa di adesso, non su quella che la sezione ha letto, e sono solo quelli del tabellone", () => {
    // La sezione ha ancora il tabellone senza risultati; nello store la prima semifinale è già registrata (per esempio dal Coach)
    const vista = tappaConTabellone();
    const esito = registraRisultatoBracket(vista, vista.bracket?.[0].id ?? "", 21, 15);
    if (!esito.ok) throw new Error(esito.errore);
    mostra(vista, esito.tappa);
    fireEvent.click(elimina());
    expect(screen.getByRole("alertdialog", { name: "Eliminare il tabellone?" }).textContent)
      .toContain("Verranno eliminati il tabellone e 1 risultato. I risultati dei gironi restano.");
  });

  it("«Annulla» non cambia niente: il tabellone e i suoi risultati restano", () => {
    mostra(tappaConTabellone());
    const prima = nelloStore();
    fireEvent.click(elimina());
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(nelloStore()).toBe(prima);
  });

  it("«Conferma» elimina il tabellone; i risultati dei gironi restano e il tabellone si può generare di nuovo", () => {
    mostra(tappaConTabellone());
    fireEvent.click(elimina());
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(nelloStore().bracket).toBeUndefined();
    expect(nelloStore().partite.every((m) => m.done)).toBe(true);
    expect(generaFasiDirette(nelloStore()).ok).toBe(true);
  });

  it("in sola lettura (archivio, pagina pubblica) il pulsante non c'è", () => {
    useAppStore.setState({ user: ospite, tappe: [tappaConTabellone()] });
    render(<BracketSection tappa={tappaConTabellone()} readOnly />);
    expect(screen.queryByRole("button", { name: "Elimina bracket e ricomincia" })).toBeNull();
  });
});
