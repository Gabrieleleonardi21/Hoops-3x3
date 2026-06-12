import { describe, it, expect } from "vitest";
import { standings } from "../../src/utils/standings";
import type { Partita } from "../../src/types";

const nameOf = (id: string) => id.toUpperCase();
const match = (a: string, b: string, sa: number, sb: number): Partita =>
  ({ id: a + b, g: 0, a, b, sa, sb, done: true });

describe("standings (classifica girone)", () => {
  it("conta vittorie, sconfitte e punti fatti/subiti", () => {
    const rows = standings(["a", "b"], [match("a", "b", 21, 15)], nameOf);
    expect(rows[0]).toMatchObject({ id: "a", v: 1, p: 0, pf: 21, ps: 15 });
    expect(rows[1]).toMatchObject({ id: "b", v: 0, p: 1, pf: 15, ps: 21 });
  });

  it("ordina per vittorie, poi punti fatti", () => {
    const rows = standings(
      ["a", "b", "c"],
      [match("a", "b", 21, 10), match("c", "b", 21, 5), match("a", "c", 15, 21)],
      nameOf
    );
    // c: 2 vittorie; a: 1; b: 0
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("ignora le partite non ancora registrate", () => {
    const pending = { ...match("a", "b", 0, 0), done: false };
    const rows = standings(["a", "b"], [pending], nameOf);
    expect(rows.every((r) => r.g === 0)).toBe(true);
  });
});
