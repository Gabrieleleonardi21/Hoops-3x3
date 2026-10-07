import { describe, expect, it } from "vitest";
import { giocatoriDi, logoSquadra, nomeGiocatore, nomeSquadra, SCONOSCIUTO, squadraDi } from "../../src/utils/tappaInfo";
import type { SquadraTappa } from "../../src/types";

const squadre: SquadraTappa[] = [
  { id: "a", nome: "Alfa", logo: "https://logo/a.png", rank: "", giocatori: [
    { id: "a1", nome: "Anna" }, { id: "a2", nome: "  " }, { id: "a3", nome: "Aldo" },
  ] },
  { id: "b", nome: "", rank: "", giocatori: [] },
];

describe("tappaInfo: squadre e giocatori di una tappa, con un solo valore di ripiego", () => {
  it("squadraDi trova la squadra per id, e non trova niente con un id assente o nullo", () => {
    expect(squadraDi(squadre, "a")?.nome).toBe("Alfa");
    expect(squadraDi(squadre, "x")).toBeUndefined();
    expect(squadraDi(squadre, null)).toBeUndefined();
    expect(squadraDi(undefined, "a")).toBeUndefined();
  });

  it("nomeSquadra dà il nome, oppure il ripiego unico se la squadra manca o non ha nome (mai l'id)", () => {
    expect(nomeSquadra(squadre, "a")).toBe("Alfa");
    expect(nomeSquadra(squadre, "x")).toBe(SCONOSCIUTO);
    expect(nomeSquadra(squadre, "b")).toBe(SCONOSCIUTO);
    expect(SCONOSCIUTO).toBe("?");
  });

  it("logoSquadra dà il logo o niente", () => {
    expect(logoSquadra(squadre, "a")).toBe("https://logo/a.png");
    expect(logoSquadra(squadre, "b")).toBeUndefined();
    expect(logoSquadra(squadre, "x")).toBeUndefined();
  });

  it("giocatoriDi dà i giocatori con il nome compilato, quelli che contano per il roster", () => {
    expect(giocatoriDi(squadre, "a").map((p) => p.id)).toEqual(["a1", "a3"]);
    expect(giocatoriDi(squadre, "x")).toEqual([]);
  });

  it("nomeGiocatore cerca in tutte le squadre, con lo stesso ripiego", () => {
    expect(nomeGiocatore(squadre, "a3")).toBe("Aldo");
    expect(nomeGiocatore(squadre, "zz")).toBe(SCONOSCIUTO);
  });
});
