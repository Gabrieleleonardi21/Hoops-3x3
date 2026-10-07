import { describe, expect, it } from "vitest";
import { COACH_TOOLS } from "../../src/coach/toolDefs";
import { NOMI_STRUMENTI, eseguiStrumento, type ContestoStrumenti } from "../../src/coach/toolHandlers";

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

  it.each(["inesistente", "constructor", "toString", "__proto__"])(
    "un nome che non è uno strumento (%s), anche se ogni oggetto ha una proprietà con quel nome, è rifiutato",
    async (nome) => {
      await expect(eseguiStrumento(nome, {}, contesto)).rejects.toThrow(`Strumento "${nome}" non riconosciuto.`);
    },
  );
});
