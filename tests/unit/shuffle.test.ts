import { describe, it, expect } from "vitest";
import { shuffle } from "../../src/utils/shuffle";

describe("shuffle", () => {
  it("restituisce gli stessi elementi, senza mutare l'originale", () => {
    const arr = [1, 2, 3, 4, 5];
    const copia = [...arr];
    const out = shuffle(arr);
    expect(arr).toEqual(copia);
    expect([...out].sort()).toEqual([...arr].sort());
    expect(out).toHaveLength(arr.length);
  });

  it("gestisce array vuoti e con un elemento", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([42])).toEqual([42]);
  });
});
