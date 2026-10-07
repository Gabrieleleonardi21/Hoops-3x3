import { describe, it, expect } from "vitest";
import { stessaTappa } from "../../src/utils/stessaTappa";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Partita, Tappa } from "../../src/types";

const partita: Partita = { id: "m1", g: 0, a: "s1", b: "s2", sa: 21, sb: 15, done: true, pa: { p1: { pt: 21 } } };

/** Una tappa come la manda il server: tutti i campi, quelli vuoti compresi, e la versione */
const dalServer = (): Tappa => ({
  id: "t1", nome: "Finale", luogo: "Roma", data: "2026-06-14", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [{ id: "s1", nome: "Uno", rank: "", giocatori: [] }], gironi: [["s1"]], partite: [partita], video: [],
  conclusa: false, bracket: null as unknown as undefined, versione: 4,
});

/** La stessa tappa con i campi di `diversi`, anche quelli che il tipo non permette (dati vecchi, campi assenti) */
const conCampi = (diversi: Record<string, unknown>) => ({ ...dalServer(), ...diversi }) as Tappa;

describe("stessaTappa: confronto con la tappa del server, dopo la normalizzazione che il server fa salvando", () => {
  it("la versione non conta: il corpo mandato ha quella vecchia, il server quella salita", () => {
    expect(stessaTappa(conCampi({ versione: 3 }), dalServer())).toBe(true);
    expect(stessaTappa(conCampi({ versione: undefined }), dalServer())).toBe(true);
  });

  it("nome, luogo e data senza gli spazi ai lati, come li salva il server", () => {
    expect(stessaTappa(conCampi({ nome: "  Finale ", luogo: " Roma  ", data: " 2026-06-14 " }), dalServer())).toBe(true);
  });

  it("luogo e data assenti sono testi vuoti", () => {
    const server = conCampi({ luogo: "", data: "" });
    expect(stessaTappa(conCampi({ luogo: undefined, data: null }), server)).toBe(true);
  });

  it("squadre, partite e video assenti sono elenchi vuoti; gironi e fase finale assenti sono null", () => {
    const server = conCampi({ squadre: [], partite: [], video: [], gironi: null, bracket: null });
    const corpo = conCampi({ squadre: undefined, partite: null, video: undefined, gironi: undefined, bracket: undefined });
    expect(stessaTappa(corpo, server)).toBe(true);
  });

  it("«conclusa» assente vale false", () => {
    expect(stessaTappa(conCampi({ conclusa: undefined }), dalServer())).toBe(true);
    expect(stessaTappa(conCampi({ conclusa: true }), dalServer())).toBe(false);
  });

  it("i blocchi di gioco si confrontano come valori: l'ordine delle chiavi e le chiavi senza valore non contano", () => {
    const riordinata = { pa: { p1: { pt: 21 } }, done: true, sb: 15, sa: 21, b: "s2", a: "s1", g: 0, id: "m1", ts: undefined };
    expect(stessaTappa(conCampi({ partite: [riordinata] }), dalServer())).toBe(true);
  });

  it("delle regole contano solo le quattro del server", () => {
    expect(stessaTappa(conCampi({ regole: { ...DEFAULT_RULES, altro: 1 } }), dalServer())).toBe(true);
  });

  it("una differenza vera nei dati si vede: un risultato, un nome, un girone, l'ordine di un elenco", () => {
    expect(stessaTappa(conCampi({ partite: [{ ...partita, sa: 20 }] }), dalServer())).toBe(false);
    expect(stessaTappa(conCampi({ nome: "Semifinale" }), dalServer())).toBe(false);
    expect(stessaTappa(conCampi({ gironi: [["s1"], []] }), dalServer())).toBe(false);
    expect(stessaTappa(conCampi({ nGironi: 2 }), dalServer())).toBe(false);
    const due = [{ id: "a", titolo: "A", url: "u" }, { id: "b", titolo: "B", url: "u" }];
    expect(stessaTappa(conCampi({ video: due }), conCampi({ video: [...due].reverse() }))).toBe(false);
  });

  it("dentro i blocchi gli spazi restano: il server non li tocca", () => {
    const squadre = [{ id: "s1", nome: "Uno ", rank: "", giocatori: [] }];
    expect(stessaTappa(conCampi({ squadre }), dalServer())).toBe(false);
  });
});
