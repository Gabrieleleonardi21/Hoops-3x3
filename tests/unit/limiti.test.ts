import { describe, expect, it } from "vitest";
import { MAX_ROSTER, MAX_SQUADRE, MIN_ROSTER, MIN_SQUADRE, nomeSegnaposto } from "../../src/constants/rules";
import { eSegnaposto } from "../../src/domain/tappaOps";

describe("limiti di una tappa, scritti in un posto solo", () => {
  it("roster da 3 a 4 giocatori, da 2 a 64 squadre", () => {
    expect([MIN_ROSTER, MAX_ROSTER]).toEqual([3, 4]);
    expect([MIN_SQUADRE, MAX_SQUADRE]).toEqual([2, 64]);
  });

  it("il nome segnaposto di una squadra nuova è «Squadra N», e tappaOps lo riconosce", () => {
    expect(nomeSegnaposto(1)).toBe("Squadra 1");
    expect(nomeSegnaposto(12)).toBe("Squadra 12");
    expect(eSegnaposto(nomeSegnaposto(7))).toBe(true);
    expect(eSegnaposto("Squadra Alfa")).toBe(false);
  });
});
