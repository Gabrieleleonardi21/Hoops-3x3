/** Campetti del circuito: lettura pubblica, scrittura con account (autore o ADMIN). */
import { z } from "zod";
import { api, ApiError } from "./api";
import { RISPOSTA_CAMPETTI_NON_VALIDA } from "../utils/testi";
import { STATI_CAMPETTO, SUPERFICI, TIPI_CAMPETTO, type Campetto, type CampettoInput } from "../types/campetto";

/** Un campetto come lo manda il server: tutti i campi del contratto, sempre. L'annotazione controlla in una direzione sola, come
 *  nell'archivio: un campo del tipo che manca allo schema non compila. Indirizzo, città e note possono essere "" ma mai null; i
 *  campi che lo schema non conosce (per esempio `fonte`, se un giorno uscisse) sono scartati e non arrivano a chi chiama */
const campettoSchema: z.ZodType<Campetto> = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  indirizzo: z.string(),
  citta: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tipo: z.enum(TIPI_CAMPETTO),
  superficie: z.enum(SUPERFICI),
  canestri: z.number().int(),
  illuminato: z.boolean(),
  coperto: z.boolean(),
  gratuito: z.boolean(),
  retine: z.boolean(),
  linee: z.boolean(),
  fontanella: z.boolean(),
  stato: z.enum(STATI_CAMPETTO),
  note: z.string(),
  autore: z.string(),
  autoreId: z.string().nullable(),
  versione: z.number(),
  ts: z.number(),
});

/** L'elenco è valido solo intero: un campetto fuori forma lo respinge tutto, non si disegna una mappa a metà */
const elencoSchema = z.array(campettoSchema);

/** Legge una risposta con lo schema. Fuori forma → ApiError, così la pagina mostra l'errore con «Riprova», mai dati a metà */
function letto<T>(schema: z.ZodType<T>, risposta: unknown): T {
  const esito = schema.safeParse(risposta);
  if (!esito.success) throw new ApiError(200, RISPOSTA_CAMPETTI_NON_VALIDA);
  return esito.data;
}

/** I due modi di GET /api/campetti (D9): i campetti entro un raggio da un punto, ordinati per distanza; oppure la ricerca di un testo
 *  in nome o città su tutta la base, ordinata per città e nome, o per distanza se c'è anche la posizione (senza raggio) */
export type RicercaCampetti =
  | { lat: number; lng: number; raggioKm: number }
  | { q: string; lat?: number; lng?: number };

/** La query string della ricerca, codificata da URLSearchParams (spazi e caratteri speciali del testo non rompono l'URL) */
function queryDi(ricerca: RicercaCampetti): string {
  const p = new URLSearchParams();
  if ("raggioKm" in ricerca) {
    p.set("lat", String(ricerca.lat));
    p.set("lng", String(ricerca.lng));
    p.set("raggioKm", String(ricerca.raggioKm));
    return p.toString();
  }
  p.set("q", ricerca.q);
  // La posizione si manda solo intera: una coordinata sola il server la respingerebbe (400)
  if (ricerca.lat !== undefined && ricerca.lng !== undefined) {
    p.set("lat", String(ricerca.lat));
    p.set("lng", String(ricerca.lng));
  }
  return p.toString();
}

export const campettiApi = {
  /** Lettura pubblica (anche senza token), al massimo 200 campetti già ordinati dal server: il client non li riordina */
  list: async (ricerca: RicercaCampetti): Promise<Campetto[]> =>
    letto(elencoSchema, await api<unknown>(`/api/campetti?${queryDi(ricerca)}`)),
  /** 201 con il campetto creato (autore = utente del token); 401 senza token */
  create: async (input: CampettoInput): Promise<Campetto> =>
    letto(campettoSchema, await api<unknown>("/api/campetti", { method: "POST", body: input })),
  /** Solo autore o ADMIN (403), 404 se non esiste, 409 se `versione` c'è ed è diversa da quella sul server */
  update: async (id: string, input: CampettoInput): Promise<Campetto> =>
    letto(campettoSchema, await api<unknown>(`/api/campetti/${id}`, { method: "PUT", body: input })),
  /** 204 senza corpo; stesse regole di accesso di update (403/404) */
  remove: (id: string) => api<void>(`/api/campetti/${id}`, { method: "DELETE" }),
};
