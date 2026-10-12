import { describe, it, expect } from "vitest";
import { distanzaKm, fmtDistanza, type Coordinate } from "../../src/utils/geo";

/** Valori noti: i centri di Torino e Milano distano circa 126 km in linea d'aria */
const TORINO: Coordinate = { lat: 45.0703, lng: 7.6869 };
const MILANO: Coordinate = { lat: 45.4642, lng: 9.19 };

describe("distanzaKm: la distanza in linea d'aria (Haversine)", () => {
  it("Torino–Milano è circa 126 km, con meno di un chilometro di scarto", () => {
    expect(Math.abs(distanzaKm(TORINO, MILANO) - 126)).toBeLessThan(1);
  });

  it("è simmetrica e vale zero tra un punto e sé stesso", () => {
    expect(distanzaKm(MILANO, TORINO)).toBeCloseTo(distanzaKm(TORINO, MILANO), 9);
    expect(distanzaKm(TORINO, TORINO)).toBe(0);
  });

  it("punti agli antipodi: mezza circonferenza (circa 20015 km), mai NaN per un arrotondamento sopra 1", () => {
    const antipodi: [Coordinate, Coordinate][] = [
      [{ lat: 0, lng: 0 }, { lat: 0, lng: 180 }],
      [{ lat: 10, lng: 20 }, { lat: -10, lng: -160 }],
      [{ lat: 45.0703, lng: 7.6869 }, { lat: -45.0703, lng: -172.3131 }],
      [{ lat: 89.9, lng: 1 }, { lat: -89.9, lng: -179 }],
    ];
    for (const [a, b] of antipodi) {
      const d = distanzaKm(a, b);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeCloseTo(Math.PI * 6371, 0);
    }
  });
});

describe("fmtDistanza: metri sotto il chilometro, chilometri con un decimale e la virgola sopra", () => {
  const casi: [number, string][] = [
    [0.85, "850 m"],
    [0, "0 m"],
    [1.234, "1,2 km"],
    [12.34, "12,3 km"],
    [1, "1,0 km"],
    [0.9996, "1,0 km"], // 999,6 m arrotondano a 1000: non «1000 m»
    [0.9994, "999 m"],
  ];

  it.each(casi)("%s km → «%s»", (km, atteso) => {
    expect(fmtDistanza(km)).toBe(atteso);
  });
});
