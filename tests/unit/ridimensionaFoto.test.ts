import { describe, it, expect } from "vitest";
import { MAX_BASE64, PIANO_RIDUZIONE, misuraRidotta, troppoGrande } from "../../src/utils/ridimensionaFoto";

/* La geometria della riduzione di una foto prima di mandarla al server: il canvas sta nell'hook (jsdom non lo ha), qui solo i conti */

describe("misuraRidotta: il lato lungo entro il massimo, proporzioni conservate", () => {
  it("una foto orizzontale o verticale più grande si riduce sul lato lungo", () => {
    expect(misuraRidotta(4000, 3000, 1600)).toEqual({ larghezza: 1600, altezza: 1200 });
    expect(misuraRidotta(3000, 4000, 1600)).toEqual({ larghezza: 1200, altezza: 1600 });
  });

  it("una foto già piccola resta com'è", () => {
    expect(misuraRidotta(800, 600, 1600)).toEqual({ larghezza: 800, altezza: 600 });
  });

  it("le misure sono intere e mai sotto 1 pixel", () => {
    expect(misuraRidotta(4032, 3023, 1200)).toEqual({ larghezza: 1200, altezza: 900 });
    expect(misuraRidotta(10000, 1, 1600)).toEqual({ larghezza: 1600, altezza: 1 });
  });
});

describe("piano di riduzione e limite del server", () => {
  it("due passi, dal più leggero al più ridotto, e il limite di 1.500.000 caratteri del server", () => {
    expect(PIANO_RIDUZIONE).toEqual([{ lato: 1600, qualita: 0.8 }, { lato: 1200, qualita: 0.7 }]);
    expect(MAX_BASE64).toBe(1_500_000);
  });

  it("troppoGrande conta solo i caratteri base64, dopo la virgola del data URL", () => {
    const prefisso = "data:image/jpeg;base64,";
    expect(troppoGrande(prefisso + "A".repeat(1_500_001))).toBe(true);
    expect(troppoGrande(prefisso + "A".repeat(1_500_000))).toBe(false);
  });
});
