import { describe, expect, it } from "vitest";
import { COACH_TOOLS } from "../../src/coach/toolDefs";
import { NOMI_STRUMENTI, eseguiStrumento, type ContestoStrumenti } from "../../src/coach/toolHandlers";
import documentazione from "../../docs/coach-ai-tool-calling.md?raw";

/** Un contesto che non deve servire: lo strumento è rifiutato prima di agire */
const contesto: ContestoStrumenti = {
  vai: () => { throw new Error("nessuna navigazione attesa"); },
  segnale: new AbortController().signal,
  chiediConferma: async () => { throw new Error("nessuna conferma attesa"); },
};

describe("Coach AI: definizioni ed esecutori degli strumenti (FP-6)", () => {
  it("ogni strumento che il modello vede ha il suo esecutore, e nessun esecutore è senza definizione", () => {
    const definiti = COACH_TOOLS.map((t) => t.function.name).sort();
    expect(definiti).toEqual([...NOMI_STRUMENTI].sort());
  });

  it("c'è correggi_squadra, che sistema nome e giocatori di una squadra della tappa (dopo l'import da una foto)", () => {
    expect(NOMI_STRUMENTI).toContain("correggi_squadra");
    const def = COACH_TOOLS.find((t) => t.function.name === "correggi_squadra");
    expect(def?.function.parameters.required).toEqual(["squadra"]);
    expect(Object.keys(def?.function.parameters.properties ?? {}).sort()).toEqual(["giocatori", "nuovo_nome", "squadra", "tappa_nome"]);
  });

  // Tappa di prova e risultati simulati: i tre strumenti stanno nell'elenco e tra le definizioni che il modello vede
  it.each(["crea_tappa_simulata", "simula_risultati", "registra_risultati"])("%s è tra gli strumenti e tra le definizioni", (nome) => {
    expect(NOMI_STRUMENTI).toContain(nome);
    expect(COACH_TOOLS.map((t) => t.function.name)).toContain(nome);
  });

  // FP-7 nacque da 8 strumenti documentati su 10: uno strumento nuovo senza la sua sezione in docs/ non passa più inosservato
  it.each(NOMI_STRUMENTI)("docs/coach-ai-tool-calling.md ha la sezione di %s", (nome) => {
    expect(documentazione.split("\n")).toContain(`### \`${nome}\``);
  });

  it.each(["inesistente", "constructor", "toString", "__proto__"])(
    "un nome che non è uno strumento (%s), anche se ogni oggetto ha una proprietà con quel nome, è rifiutato",
    async (nome) => {
      await expect(eseguiStrumento(nome, {}, contesto)).rejects.toThrow(`Strumento "${nome}" non riconosciuto.`);
    },
  );
});
