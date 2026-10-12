/** Il luogo cercato quando la ricerca dei campetti non trova niente (`GET /api/luoghi?q=`, D9): il backend chiede a Nominatim dove si
 *  trova il testo, e la pagina sposta la mappa lì. Lettura pubblica (anche da Ospite), come quella dei campetti. */
import { z } from "zod";
import { ApiError, api } from "./api";
import { RISPOSTA_CAMPETTI_NON_VALIDA } from "../utils/testi";

export interface Luogo { nome: string; lat: number; lng: number }

/** La forma che il server manda. Se non è questa, il luogo non si usa: una mappa centrata su coordinate sbagliate direbbe il falso */
const luogoSchema: z.ZodType<Luogo> = z.object({
  nome: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const luoghiApi = {
  /** 404 («Luogo non trovato») se il testo non è un luogo; 400 per un testo fuori da 2–100 caratteri; 502 se il servizio dei luoghi non
   *  risponde. Gli errori arrivano come ApiError, con lo status del server */
  cerca: async (q: string): Promise<Luogo> => {
    const esito = luogoSchema.safeParse(await api<unknown>(`/api/luoghi?${new URLSearchParams({ q }).toString()}`));
    if (!esito.success) throw new ApiError(200, RISPOSTA_CAMPETTI_NON_VALIDA);
    return esito.data;
  },
};
