/** Archivio circuito: snapshot pubblici delle tappe concluse. */
import { z } from "zod";
import { api, ApiError } from "./api";
import { ELENCO_ARCHIVIO_NON_VALIDO, TAPPE_ARCHIVIO_NON_VALIDE } from "../utils/testi";
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

/** Solo ciò che `statGiocatori` legge davvero: l'id e gli array di squadre e partite di ogni tappa. Il resto lo garantisce il
 *  server (è lo stesso oggetto di `get`); i campi che lo schema non conosce passano com'è */
const tappeSchema = z.array(z.object({
  tappa: z.object({ id: z.string().min(1), squadre: z.array(z.unknown()), partite: z.array(z.unknown()) }).passthrough(),
}).passthrough());

export const archivioApi = {
  /** Elenco sintetico, già ordinato dal server dalla pubblicazione più recente (il client non lo riordina). Se la risposta non
   *  ha la forma attesa, per esempio quella di prima con la tappa intera in ogni voce, rifiuta con un ApiError: la pagina mostra
   *  l'errore con «Riprova», mai righe vuote. */
  list: async (): Promise<PubTappaMeta[]> => {
    const letto = elencoSchema.safeParse(await api<unknown>("/api/archivio"));
    if (!letto.success) throw new ApiError(200, ELENCO_ARCHIVIO_NON_VALIDO);
    return letto.data;
  },
  /** Tutte le tappe pubblicate intere (pubbliche, senza account): servono a calcolare le statistiche dei giocatori. Una risposta
   *  fuori forma rifiuta con un ApiError, come `list`: mai statistiche su dati a metà. */
  tappe: async (): Promise<PubTappa[]> => {
    const risposta = await api<unknown>("/api/archivio/tappe");
    if (!tappeSchema.safeParse(risposta).success) throw new ApiError(200, TAPPE_ARCHIVIO_NON_VALIDE);
    // Si è controllato ciò che le statistiche leggono, e si restituisce la risposta intera (lo schema non toglie nulla); il resto
    // della forma di PubTappa lo garantisce il server
    return risposta as PubTappa[];
  },
  get: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`),
  /** Pubblica o ripubblica (upsert sull'id della tappa). Senza corpo: la copia la costruisce il server dalla tappa che ha
   *  salvato, che deve essere già conclusa. Chi chiama deve prima aver salvato tutto: lo fa `pubblica` dello store. */
  pubblica: (tappaId: string) => api<PubTappa>(`/api/archivio/${tappaId}`, { method: "PUT" }),
  rimuovi: (tappaId: string) => api<void>(`/api/archivio/${tappaId}`, { method: "DELETE" }),
};
