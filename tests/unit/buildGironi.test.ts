import { describe, it, expect } from "vitest";
import { buildGironi } from "../../src/utils/buildGironi";

describe("buildGironi (sorteggio casuale)", () => {
  it("distribuisce tutte le squadre nel numero di gironi richiesto", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const gironi = buildGironi(ids, 2);
    expect(gironi).toHaveLength(2);
    expect(gironi[0]).toHaveLength(4);
    expect(gironi[1]).toHaveLength(4);
    expect(gironi.flat().sort()).toEqual([...ids].sort());
  });

  it("con squadre dispari i primi gironi hanno una squadra in più", () => {
    const gironi = buildGironi(["a", "b", "c", "d", "e"], 2);
    expect(gironi[0]).toHaveLength(3);
    expect(gironi[1]).toHaveLength(2);
  });

  it("nessuna squadra è duplicata", () => {
    const gironi = buildGironi(["a", "b", "c", "d", "e", "f"], 3);
    const flat = gironi.flat();
    expect(new Set(flat).size).toBe(flat.length);
  });
});
