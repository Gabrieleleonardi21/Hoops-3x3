/** Archivio circuito: snapshot pubblici delle tappe concluse. */
import { z } from "zod";
import { api, ApiError } from "./api";
import { ELENCO_ARCHIVIO_NON_VALIDO } from "../utils/testi";
import type { PubTappa, PubTappaMeta } from "../types";

/** Una voce dell'elenco: tutti e otto i campi, sempre. L'annotazione controlla in una direzione sola: un campo del tipo che manca
 *  allo schema (o scritto con un altro tipo) non compila; un campo in più nello schema compila lo stesso, e un test fissa i campi
 *  che escono. `luogo` e `data` possono essere "" ma mai assenti o null. Una voce con la forma di prima (la tappa intera dentro)
 *  non ha questi campi e non passa. I campi che lo schema non conosce sono scartati: un campo nuovo aggiunto dal server non rompe
 *  l'app, ma non arriva a chi chiama. */
const voceSchema: z.ZodType<PubTappaMeta> = z.object({
  tappaId: z.string().min(1),
  nome: z.string(),
  luogo: z.string(),
  data: z.string(),
  nSquadre: z.number().int().nonnegative(),
  lega: z.string(),
  autore: z.string(),
  ts: z.number(),
});

/** L'elenco è valido solo intero: una voce fuori forma lo respinge tutto, non si disegna una lista a metà */
const elencoSchema = z.array(voceSchema);

export const archivioApi = {
  /** Elenco sintetico, già ordinato dal server dalla pubblicazione più recente (il client non lo riordina). Se la risposta non
   *  ha la forma attesa, per esempio quella di prima con la tappa intera in ogni voce, rifiuta con un ApiError: la pagina mostra
   *  l'errore con «Riprova», mai righe vuote. */
  list: async (): Promise<PubTappaMeta[]> => {
    const letto = elencoSchema.safeParse(await api<unknown>("/api/archivio"));
    if (!letto.success) throw new ApiError(200, ELENCO_ARCHIVIO_NON_VALIDO);
    return letto.data;
  },
  get: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`),
  /** Pubblica o ripubblica (upsert sull'id della tappa). Senza corpo: la copia la costruisce il server dalla tappa che ha
   *  salvato, che deve essere già conclusa. Chi chiama deve prima aver salvato tutto: lo fa `pubblica` dello store. */
  pubblica: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`, { method: "PUT" }),
  rimuovi: (tappaId: string) => api<void>(`/api/archivio/${tappaId}`, { method: "DELETE" }),
};
