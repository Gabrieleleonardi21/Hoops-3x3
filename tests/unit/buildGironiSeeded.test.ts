import { describe, it, expect } from "vitest";
import { buildGironiSeeded } from "../../src/utils/buildGironiSeeded";

describe("buildGironiSeeded (sorteggio per ranking)", () => {
  const teams = [
    { id: "t1", rank: 100 },
    { id: "t2", rank: 80 },
    { id: "t3", rank: 60 },
    { id: "t4", rank: 40 },
    { id: "t5", rank: 20 },
    { id: "t6", rank: 10 },
  ];

  it("separa le prime due teste di serie in gironi diversi", () => {
    const gironi = buildGironiSeeded(teams, 2);
    const gOf = (id: string) => gironi.findIndex((g) => g.includes(id));
    expect(gOf("t1")).not.toBe(gOf("t2"));
  });

  it("serpentina: il girone della 1ª riceve anche la 4ª", () => {
    const gironi = buildGironiSeeded(teams, 2);
    const gOf = (id: string) => gironi.findIndex((g) => g.includes(id));
    expect(gOf("t1")).toBe(gOf("t4")); // A: 1°,4°,5° — B: 2°,3°,6°
    expect(gOf("t2")).toBe(gOf("t3"));
  });

  it("include tutte le squadre una sola volta", () => {
    const gironi = buildGironiSeeded(teams, 3);
    const flat = gironi.flat();
    expect(flat).toHaveLength(6);
    expect(new Set(flat).size).toBe(6);
  });

  it("rank mancanti o non numerici valgono 0", () => {
    const gironi = buildGironiSeeded([{ id: "x", rank: "" }, { id: "y", rank: 5 }], 2);
    expect(gironi[0]).toEqual(["y"]); // y è testa di serie
    expect(gironi[1]).toEqual(["x"]);
  });
});
