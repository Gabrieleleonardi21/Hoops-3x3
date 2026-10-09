/** I sei campetti di Torino del contratto della fase 5, uguali al seed demo del backend (`seed/campetti-torino.json`): solo per i test
 *  e lo sviluppo, finché la pagina non legge dall'API. Coordinate dai centroidi delle aree verdi di OpenStreetMap (© OpenStreetMap
 *  contributors, ODbL), lette il 9 ottobre 2026: sono il centro del parco, non il campo, da verificare sul posto. Id, autore e
 *  tempi sono fissi perché i test li confrontino alla lettera. */
import type { Campetto } from "../../src/types/campetto";

/** L'id dell'autore di tutti i campetti di esempio (l'admin del seed nel backend) */
export const AUTORE_ID_DEMO = "a0000000-0000-4000-8000-000000000000";
/** Istante fisso di modifica (ms UTC) */
export const TS_DEMO = 1760000000000;

/** Un campetto di esempio: i campi uguali per tutti sono qui, quelli del singolo campo li dà chi chiama */
function campetto(n: number, dati: Omit<Campetto, "id" | "tipo" | "note" | "autore" | "autoreId" | "versione" | "ts">): Campetto {
  return {
    id: `c0000000-0000-4000-8000-00000000000${n}`,
    tipo: "campetto",
    note: "",
    autore: "HOOP 3X3",
    autoreId: AUTORE_ID_DEMO,
    versione: 0,
    ts: TS_DEMO,
    ...dati,
  };
}

export const CAMPETTI_DEMO: Campetto[] = [
  campetto(1, { nome: "Parco Ruffini — Campo 2", indirizzo: "Corso Trapani 32", citta: "Torino", lat: 45.05923, lng: 7.63174, superficie: "Asfalto", canestri: 2, illuminato: true, coperto: false, gratuito: true, retine: true, linee: true, fontanella: true, stato: "buono" }),
  campetto(2, { nome: "Giardini Reali — Playground", indirizzo: "Viale Primo Maggio", citta: "Torino", lat: 45.07247, lng: 7.68918, superficie: "Cemento", canestri: 2, illuminato: true, coperto: false, gratuito: true, retine: true, linee: true, fontanella: false, stato: "buono" }),
  campetto(3, { nome: "Parco Dora — Le Arcate", indirizzo: "Via Nole / Corso Mortara", citta: "Torino", lat: 45.08972, lng: 7.66669, superficie: "Sintetico", canestri: 4, illuminato: true, coperto: true, gratuito: true, retine: true, linee: true, fontanella: true, stato: "buono" }),
  campetto(4, { nome: "Piazza d'Armi — Spazio 3x3", indirizzo: "Corso Galileo Ferraris", citta: "Torino", lat: 45.04383, lng: 7.65277, superficie: "Asfalto", canestri: 2, illuminato: false, coperto: false, gratuito: true, retine: false, linee: true, fontanella: true, stato: "discreto" }),
  campetto(5, { nome: "Campo Vanchiglia", indirizzo: "Lungo Po Antonelli", citta: "Torino", lat: 45.07047, lng: 7.7169, superficie: "Cemento", canestri: 2, illuminato: true, coperto: false, gratuito: false, retine: true, linee: true, fontanella: false, stato: "discreto" }),
  campetto(6, { nome: "Parco Colletta — Campo A", indirizzo: "Via Carcano", citta: "Torino", lat: 45.08251, lng: 7.71858, superficie: "Asfalto", canestri: 2, illuminato: true, coperto: false, gratuito: true, retine: false, linee: false, fontanella: true, stato: "da sistemare" }),
];
