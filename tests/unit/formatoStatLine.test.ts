import { describe, expect, it } from "vitest";
import { fmtMedia, letteraGirone } from "../../src/utils/formato";
import { toStatLine } from "../../src/utils/statLine";

describe("toStatLine: il tabellino di un giocatore, anche nel formato vecchio", () => {
  it("il formato vecchio è un numero: i soli punti", () => {
    expect(toStatLine(12)).toEqual({ pt: 12 });
    expect(toStatLine(0)).toEqual({ pt: 0 });
  });

  it("il formato nuovo resta com'è", () => {
    expect(toStatLine({ pt: 5, rb: 3 })).toEqual({ pt: 5, rb: 3 });
  });

  it("un tabellino mancante o nullo è vuoto, senza errori", () => {
    expect(toStatLine(undefined)).toEqual({});
    expect(toStatLine(null)).toEqual({});
  });
});

describe("formato: testi brevi ripetuti nelle pagine", () => {
  it("letteraGirone: il primo girone è A, poi B, C…", () => {
    expect([0, 1, 2, 7].map(letteraGirone)).toEqual(["A", "B", "C", "H"]);
  });

  it("fmtMedia: un decimale con la virgola", () => {
    expect(fmtMedia(7.5)).toBe("7,5");
    expect(fmtMedia(10 / 3)).toBe("3,3");
    expect(fmtMedia(4)).toBe("4,0");
  });
});
