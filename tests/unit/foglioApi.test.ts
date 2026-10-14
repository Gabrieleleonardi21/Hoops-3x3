import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { foglioApi } from "../../src/services/foglioApi";
import { BOZZA_FOGLIO_NON_VALIDA } from "../../src/utils/testi";
import { azzeraRete, chiamata, rispondi, rispondiConErrore } from "./reteFinta";
import type { BozzaFoglio } from "../../src/types";

/* La lettura di una foto di un foglio (`POST /api/coach/foglio`): la rete è finta, `api` e la lettura con zod sono quelli veri */

const IMMAGINE = "data:image/jpeg;base64,/9j/AAAA";

const BOZZA: BozzaFoglio = {
  nome: "Tappa di Roma", luogo: null, data: "2026-06-14",
  squadre: [{ nome: "Alfa", giocatori: ["Mario Rossi"] }, { nome: "Beta", giocatori: [] }],
  gironi: null,
  partite: [{ a: "Alfa", b: "Beta", puntiA: 21, puntiB: null }],
  dubbi: ["Il punteggio di Beta non si legge"],
};

beforeEach(() => {
  azzeraRete();
  vi.spyOn(AbortSignal, "timeout");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("foglioApi.leggi", () => {
  it("manda POST /api/coach/foglio con {immagine}, aspetta fino a 65 secondi e restituisce la bozza", async () => {
    rispondi(BOZZA);
    expect(await foglioApi.leggi(IMMAGINE)).toEqual(BOZZA);
    expect(chiamata()).toMatchObject({ url: "/api/coach/foglio", metodo: "POST", corpo: { immagine: IMMAGINE } });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(65_000);
  });

  it("una bozza fuori forma (squadre mancanti, punteggio come testo) è un ApiError con il messaggio della forma", async () => {
    const { squadre: _squadre, ...senzaSquadre } = BOZZA;
    rispondi(senzaSquadre);
    await expect(foglioApi.leggi(IMMAGINE)).rejects.toMatchObject({ status: 200, message: BOZZA_FOGLIO_NON_VALIDA });
    rispondi({ ...BOZZA, partite: [{ a: "Alfa", b: "Beta", puntiA: "21", puntiB: 15 }] });
    await expect(foglioApi.leggi(IMMAGINE)).rejects.toMatchObject({ status: 200, message: BOZZA_FOGLIO_NON_VALIDA });
  });

  it("gli errori del server arrivano com'è, con status e messaggio (503 non configurato, 429 con i secondi)", async () => {
    rispondiConErrore(503, "Lettura dei fogli non configurata sul server (AI_LETTORE_FOGLIO)");
    await expect(foglioApi.leggi(IMMAGINE)).rejects.toMatchObject({
      status: 503, message: "Lettura dei fogli non configurata sul server (AI_LETTORE_FOGLIO)",
    });
    rispondiConErrore(429, "Troppe foto in poco tempo: riprova tra 42 secondi");
    await expect(foglioApi.leggi(IMMAGINE)).rejects.toMatchObject({
      status: 429, message: "Troppe foto in poco tempo: riprova tra 42 secondi",
    });
  });
});
