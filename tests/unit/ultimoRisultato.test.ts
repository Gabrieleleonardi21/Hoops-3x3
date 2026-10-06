import { describe, it, expect } from "vitest";
import { ultimoRisultato } from "../../src/utils/ultimoRisultato";
import type { Partita } from "../../src/types";

/** Partita del calendario tra due squadre; `ts` è il momento in cui è stato registrato il risultato (se c'è) */
const partita = (id: string, done: boolean, ts?: number): Partita => {
  const m: Partita = { id, g: 0, a: "a", b: "b", sa: 21, sb: 15, done };
  if (ts !== undefined) m.ts = ts;
  return m;
};

describe("ultimoRisultato: l'ultimo registrato, non l'ultimo del calendario (FD-10)", () => {
  it("è la partita giocata con il momento di registrazione più alto, qualunque posto abbia nel calendario", () => {
    const partite = [partita("m1", true, 300), partita("m2", true, 100), partita("m3", true, 200), partita("m4", false)];
    expect(ultimoRisultato(partite)?.id).toBe("m1");
  });

  it("senza momenti di registrazione (dati vecchi) vale l'ordine del calendario: l'ultima giocata", () => {
    const partite = [partita("m1", true), partita("m2", true), partita("m3", false)];
    expect(ultimoRisultato(partite)?.id).toBe("m2");
  });

  it("una partita registrata dopo la comparsa del campo batte quelle vecchie, anche se è prima nel calendario", () => {
    const partite = [partita("m1", true, 50), partita("m2", true), partita("m3", true)];
    expect(ultimoRisultato(partite)?.id).toBe("m1");
  });

  it("a pari momento (due registrazioni nello stesso millisecondo) vale l'ordine del calendario", () => {
    const partite = [partita("m1", true, 100), partita("m2", true, 100)];
    expect(ultimoRisultato(partite)?.id).toBe("m2");
  });

  it("le partite ancora da giocare non contano, nemmeno se hanno un momento (risultato annullato con «Correggi»)", () => {
    const partite = [partita("m1", true, 100), partita("m2", false, 900)];
    expect(ultimoRisultato(partite)?.id).toBe("m1");
  });

  it("nessuna partita giocata: nessun risultato", () => {
    expect(ultimoRisultato([])).toBeNull();
    expect(ultimoRisultato([partita("m1", false)])).toBeNull();
  });

  it("non cambia l'ordine dell'elenco ricevuto", () => {
    const partite = [partita("m1", true, 300), partita("m2", true, 100)];
    ultimoRisultato(partite);
    expect(partite.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});
