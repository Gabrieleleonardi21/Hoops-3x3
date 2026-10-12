/** Campetto da streetball del circuito: il `CampettoDTO` del backend (contratto della fase 5), con la forma dell'anagrafe (autore,
 *  versione, ts). Le liste dei valori ammessi sono costanti perché il client le usa due volte: nello schema zod che legge le risposte
 *  e nelle tendine del form. */

/** Tipo di struttura: solo in risposta (D10). Le creazioni dall'app sono sempre "campetto"; il client lo legge ma non lo mostra */
export const TIPI_CAMPETTO = ["campetto", "palestra", "arena"] as const;
export type TipoCampetto = (typeof TIPI_CAMPETTO)[number];

export const SUPERFICI = ["Asfalto", "Cemento", "Sintetico", "Altro"] as const;
export type Superficie = (typeof SUPERFICI)[number];

/** Stato del campo, come lo mostra Pick-Roll prima di andarci */
export const STATI_CAMPETTO = ["buono", "discreto", "da sistemare"] as const;
export type StatoCampetto = (typeof STATI_CAMPETTO)[number];

export interface Campetto {
  id: string;
  nome: string;
  indirizzo: string; // "" se manca: il server non manda mai null
  citta: string;     // "" se manca
  lat: number;       // −90..90
  lng: number;       // −180..180
  tipo: TipoCampetto;
  superficie: Superficie;
  canestri: number;  // intero, 1..8
  illuminato: boolean;
  coperto: boolean;
  gratuito: boolean;
  retine: boolean;
  linee: boolean;
  fontanella: boolean;
  stato: StatoCampetto;
  note: string;      // "" se manca
  autore: string;    // nome visualizzato dell'autore, "" se l'autore non esiste più (non è unico: non decide i permessi)
  autoreId: string | null; // id dell'autore: decide chi può modificare (utils/permessi); null se l'autore non esiste più
  /** Numero di versione sul server (blocco ottimistico): la PUT lo rimanda, 409 se un altro dispositivo ha salvato nel frattempo */
  versione: number;
  ts: number;        // modifica, ms UTC
}

/** Campi compilabili (`CampettoRequestDTO`): id, tipo, autore, autoreId e ts li assegna il server. `versione` resta facoltativa: la PUT
 *  la rimanda per dire su quale versione si basano le modifiche; la POST non ce l'ha e JSON.stringify la lascia fuori */
export type CampettoInput = Omit<Campetto, "id" | "tipo" | "autore" | "autoreId" | "ts" | "versione"> & { versione?: number };
