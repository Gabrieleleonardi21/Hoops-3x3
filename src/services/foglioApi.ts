/** Lettura della foto di un foglio di tappa (`POST /api/coach/foglio`): il server la passa a un modello con immagini e risponde la
 *  bozza della tappa. Solo per chi ha un account (l'ospite riceverebbe 401: la pagina non lo fa nemmeno partire). La foto va al
 *  server e da lì al fornitore; qui non si salva e non si logga. */
import { z } from "zod";
import { ApiError, api } from "./api";
import { BOZZA_FOGLIO_NON_VALIDA } from "../utils/testi";
import type { BozzaFoglio } from "../types";

/** Tempo massimo della lettura (ms): il server aspetta il modello fino a 60 secondi, come per la chat del Coach, quindi il client
 *  aspetta un po' di più per ricevere la risposta o l'errore del server invece di abbandonare prima */
const TEMPO_MASSIMO_FOGLIO = 65_000;

const testoONull = z.string().nullable();
const punti = z.number().nullable();

/** La bozza come la manda il server (BozzaFoglioDTO). Fuori forma non si usa: diventerebbe una tappa con dati a metà */
const bozzaSchema: z.ZodType<BozzaFoglio> = z.object({
  nome: testoONull,
  luogo: testoONull,
  data: testoONull,
  squadre: z.array(z.object({ nome: z.string(), giocatori: z.array(z.string()) })),
  gironi: z.array(z.array(z.string())).nullable(),
  partite: z.array(z.object({ a: z.string(), b: z.string(), puntiA: punti, puntiB: punti })),
  dubbi: z.array(z.string()),
});

export const foglioApi = {
  /** `immagine` è un data URL JPEG già ridotto (useImportaFoto). Errori del server come ApiError con il suo messaggio: 400 formato
   *  o dimensione, 429 limite (con i secondi), 502 lettore non disponibile, 503 lettura non configurata */
  leggi: async (immagine: string): Promise<BozzaFoglio> => {
    const risposta = await api<unknown>("/api/coach/foglio", {
      method: "POST", body: { immagine }, tempoMassimo: TEMPO_MASSIMO_FOGLIO,
    });
    const esito = bozzaSchema.safeParse(risposta);
    if (!esito.success) throw new ApiError(200, BOZZA_FOGLIO_NON_VALIDA);
    return esito.data;
  },
};
