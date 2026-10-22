import { describe, it, expect } from "vitest";
import { chiaviInOrdine } from "../../src/utils/chiaviInOrdine";

describe("chiaviInOrdine: le chiavi degli oggetti in ordine alfabetico, a ogni livello", () => {
  it("un oggetto annidato ha le chiavi in ordine a ogni livello, anche dentro un elenco", () => {
    const valore = { b: { y: 1, x: [{ d: 1, c: 2 }] }, a: null };
    expect(JSON.stringify(chiaviInOrdine(valore))).toBe('{"a":null,"b":{"x":[{"c":2,"d":1}],"y":1}}');
  });

  it("gli elenchi restano nell'ordine dato", () => {
    expect(chiaviInOrdine(["Beta", "Alfa"])).toEqual(["Beta", "Alfa"]);
  });

  it("primitivi e null restano come sono", () => {
    expect(chiaviInOrdine(5)).toBe(5);
    expect(chiaviInOrdine("Roma")).toBe("Roma");
    expect(chiaviInOrdine(true)).toBe(true);
    expect(chiaviInOrdine(null)).toBeNull();
  });

  it("due oggetti con le stesse chiavi in un altro ordine danno lo stesso testo", () => {
    const a = JSON.parse('{"nome":"Delta","citta":"Roma"}');
    const b = JSON.parse('{ "citta": "Roma", "nome": "Delta" }');
    expect(JSON.stringify(chiaviInOrdine(a))).toBe(JSON.stringify(chiaviInOrdine(b)));
  });
});
