import type { Tappa } from "./tappa";

/** Giocatore registrato nell'anagrafe condivisa del circuito */
export interface RegGiocatore {
  id: string;
  nome: string;
  cognome: string;
  soprannome: string;
  nascita: string;
  citta: string;
  nazionalita: string;
  altezza: string;
  peso: string;
  ruolo: string;
  numero: string;
  squadra: string;
  esperienza: string;
  note: string;
  autore: string;   // nome visualizzato dell'autore (non è unico: non decide i permessi)
  autoreId: string; // id dell'autore: decide chi può modificare (utils/permessi)
  ts: number;
}

/** Squadra registrata nell'anagrafe condivisa */
export interface RegSquadra {
  id: string;
  nome: string;
  citta: string;
  anno: string;
  rank: string;
  referente: string;
  roster: string[]; // id di RegGiocatore
  logo: string;      // URL o path /logos/*.svg
  website: string;   // URL sito web ufficiale (opzionale)
  instagram: string; // URL pagina Instagram (usato come link del logo se manca il sito)
  note: string;
  autore: string;   // nome visualizzato dell'autore (non è unico: non decide i permessi)
  autoreId: string; // id dell'autore: decide chi può modificare (utils/permessi)
  ts: number;
}

/** Tappa conclusa e pubblicata nell'archivio del circuito */
export interface PubTappa {
  tappa: Tappa;
  lega: string;
  autore: string;   // nome visualizzato dell'autore
  autoreId: string; // id dell'autore
  ts: number;
}
