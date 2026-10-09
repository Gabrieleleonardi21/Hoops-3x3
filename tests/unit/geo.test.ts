import { describe, it, expect } from "vitest";
import { coordinateDa, distanzaKm, fmtDistanza, inquadra, proietta, type Coordinate } from "../../src/utils/geo";

/** Valori noti: i centri di Torino e Milano distano circa 126 km in linea d'aria */
const TORINO: Coordinate = { lat: 45.0703, lng: 7.6869 };
const MILANO: Coordinate = { lat: 45.4642, lng: 9.19 };
/** Il centro di Roma che la pagina usa all'apertura (contratto della fase 5) */
const ROMA: Coordinate = { lat: 41.9028, lng: 12.4964 };
/** La misura del lato dell'immagine della mappa (Maps Static API, size=640x640) */
const LATO = 640;

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

describe("proietta e coordinateDa: Web Mercator, l'una l'inversa dell'altra", () => {
  it("il centro dell'inquadratura finisce al centro dell'immagine", () => {
    expect(proietta(TORINO.lat, TORINO.lng, TORINO, 12, LATO)).toEqual({ x: LATO / 2, y: LATO / 2 });
  });

  it("nord e est dell'immagine: un punto più a nord sta più in alto (y minore), uno più a est più a destra (x maggiore)", () => {
    const p = proietta(TORINO.lat + 0.01, TORINO.lng + 0.01, TORINO, 12, LATO);
    expect(p.y).toBeLessThan(LATO / 2);
    expect(p.x).toBeGreaterThan(LATO / 2);
  });

  it("a uno zoom in più la stessa distanza dal centro vale il doppio dei pixel", () => {
    const a = proietta(MILANO.lat, MILANO.lng, TORINO, 8, LATO);
    const b = proietta(MILANO.lat, MILANO.lng, TORINO, 9, LATO);
    expect(b.x - LATO / 2).toBeCloseTo(2 * (a.x - LATO / 2), 6);
    expect(b.y - LATO / 2).toBeCloseTo(2 * (a.y - LATO / 2), 6);
  });

  it("andata e ritorno tornano al punto di partenza entro un metro, a ogni zoom", () => {
    for (const zoom of [1, 8, 12, 15, 18]) {
      const { x, y } = proietta(MILANO.lat, MILANO.lng, TORINO, zoom, LATO);
      const ritorno = coordinateDa(x, y, TORINO, zoom, LATO);
      expect(distanzaKm(ritorno, MILANO)).toBeLessThan(0.001);
    }
  });

  it("ai poli (lat ±90, dove Mercator diverge) la proiezione resta finita e dentro il mondo", () => {
    for (const lat of [90, -90]) {
      const { x, y } = proietta(lat, 0, { lat: 0, lng: 0 }, 1, LATO);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(x)).toBe(true);
      // Il mondo a zoom 1 è alto 512 px e il centro (0,0) sta a LATO/2: il polo non esce dai 512 px del mondo
      expect(Math.abs(y - LATO / 2)).toBeLessThanOrEqual(256);
    }
    // Il clamp a ±85.0511 non tocca le latitudini normali: oltre quel limite vale il limite
    expect(proietta(90, 0, { lat: 0, lng: 0 }, 1, LATO).y).toBeCloseTo(proietta(85.0511, 0, { lat: 0, lng: 0 }, 1, LATO).y, 6);
  });

  it("un clic sul centro dell'immagine è il centro dell'inquadratura", () => {
    const c = coordinateDa(LATO / 2, LATO / 2, ROMA, 12, LATO);
    expect(c.lat).toBeCloseTo(ROMA.lat, 9);
    expect(c.lng).toBeCloseTo(ROMA.lng, 9);
  });
});

describe("inquadra: centro e zoom che contengono tutti i punti", () => {
  /** true se il punto proiettato sta dentro l'immagine, bordi compresi */
  const dentro = (p: Coordinate, centro: Coordinate, zoom: number) => {
    const { x, y } = proietta(p.lat, p.lng, centro, zoom, LATO);
    return x >= 0 && x <= LATO && y >= 0 && y <= LATO;
  };

  it("senza punti inquadra il centro di Roma allo zoom 12", () => {
    expect(inquadra([], LATO)).toEqual({ centro: ROMA, zoom: 12 });
  });

  it("un solo punto: è lui il centro, allo zoom 15 (il quartiere, non il singolo campo)", () => {
    expect(inquadra([TORINO], LATO)).toEqual({ centro: TORINO, zoom: 15 });
  });

  it("due punti agli angoli opposti del riquadro: il centro è il centro del riquadro, lo zoom 12, e stanno dentro il margine del 10%", () => {
    const nordOvest: Coordinate = { lat: 45.09, lng: 7.63 };
    const sudEst: Coordinate = { lat: 45.04, lng: 7.72 };
    const { centro, zoom } = inquadra([nordOvest, sudEst], LATO);
    expect(centro.lat).toBeCloseTo(45.065, 9);
    expect(centro.lng).toBeCloseTo(7.675, 9);
    // 0,09° di longitudine a zoom 12 sono circa 262 px, a zoom 13 circa 524: più degli 512 px che il margine lascia liberi
    expect(zoom).toBe(12);
    for (const p of [nordOvest, sudEst]) {
      const { x, y } = proietta(p.lat, p.lng, centro, zoom, LATO);
      expect(x).toBeGreaterThanOrEqual(LATO / 10);
      expect(x).toBeLessThanOrEqual(LATO * 0.9);
      expect(y).toBeGreaterThanOrEqual(LATO / 10);
      expect(y).toBeLessThanOrEqual(LATO * 0.9);
    }
  });

  it("lo zoom è il più grande possibile: uno in più e un punto esce dal margine", () => {
    const punti: Coordinate[] = [{ lat: 45.09, lng: 7.63 }, { lat: 45.04, lng: 7.72 }, { lat: 45.07, lng: 7.69 }];
    const { centro, zoom } = inquadra(punti, LATO);
    // Con il margine, a zoom+1 almeno un punto starebbe a meno di un decimo del lato dal bordo, o fuori
    const margine = LATO / 10;
    const fuoriDalMargine = punti.some((p) => {
      const { x, y } = proietta(p.lat, p.lng, centro, zoom + 1, LATO);
      return x < margine || x > LATO - margine || y < margine || y > LATO - margine;
    });
    expect(fuoriDalMargine).toBe(true);
    expect(punti.every((p) => dentro(p, centro, zoom))).toBe(true);
  });

  it("punti lontani (Torino e Milano) chiedono uno zoom basso, punti nella stessa città uno alto", () => {
    const lontani = inquadra([TORINO, MILANO], LATO).zoom;
    const vicini = inquadra([{ lat: 45.09, lng: 7.63 }, { lat: 45.04, lng: 7.72 }], LATO).zoom;
    expect(lontani).toBeLessThan(vicini);
  });

  it("due campetti nello stesso punto, o a pochi metri: lo zoom si ferma a 15, il quartiere, come per un punto solo", () => {
    expect(inquadra([TORINO, { ...TORINO }], LATO).zoom).toBe(15);
    expect(inquadra([TORINO, { lat: TORINO.lat + 0.0002, lng: TORINO.lng + 0.0002 }], LATO).zoom).toBe(15);
  });

  it("punti agli antipodi del mondo: lo zoom non scende sotto 1", () => {
    expect(inquadra([{ lat: 80, lng: -179 }, { lat: -80, lng: 179 }], LATO).zoom).toBe(1);
  });
});
