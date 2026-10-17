import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Il Blueprint di Render (render.yaml): le variabili del backend per la lettura delle foto dei fogli (fase 9). Non stanno nel
 * repository (sync: false, le imposta Gabriele dal pannello di Render): il fornitore, la chiave Anthropic e il modello con immagini di
 * Groq, che senza un valore usa il predefinito del backend (application.properties). */

const righe = readFileSync(new URL("../../render.yaml", import.meta.url), "utf8").split("\n").map((r) => r.trim());

/** La riga dopo `- key: <nome>` nel servizio del backend (hoop3x3-api): `sync: false` oppure `value: …` */
function impostazione(nome: string): string | undefined {
  const inizioBackend = righe.indexOf("name: hoop3x3-api");
  const i = righe.findIndex((r, j) => j > inizioBackend && r === `- key: ${nome}`);
  if (inizioBackend < 0 || i < 0) return undefined;
  return righe[i + 1];
}

describe("render.yaml: la lettura delle foto dei fogli nel servizio del backend", () => {
  it("fornitore, chiave Anthropic e modello con immagini di Groq si impostano dal pannello di Render (sync: false)", () => {
    expect(impostazione("AI_LETTORE_FOGLIO")).toBe("sync: false");
    expect(impostazione("ANTHROPIC_API_KEY")).toBe("sync: false");
    // Il predefinito sta nel backend: scritto anche qui, un cambio là non arriverebbe a Render
    expect(impostazione("GROQ_MODELLO_VISIONE")).toBe("sync: false");
  });
});
