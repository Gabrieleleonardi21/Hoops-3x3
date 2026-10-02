/** DATI DI ESEMPIO per la pagina Campetti. Non esiste ancora un modello dati né persistenza:
 *  questa lista serve a definire l'interfaccia e va sostituita da storage/API quando la
 *  funzionalità verrà implementata. Le coordinate sono relative (0–100) alla mappa schematica. */
export interface Campetto {
  id: string;
  nome: string;
  indirizzo: string;
  citta: string;
  superficie: "Asfalto" | "Cemento" | "Sintetico";
  illuminato: boolean;
  coperto: boolean;
  canestri: number;
  gratuito: boolean;
  rating: number;      // 0–5
  recensioni: number;
  distanzaKm: number;
  ultimaTappa?: string; // ISO date
  x: number; y: number; // posizione sulla mappa schematica (percentuale)
}

export const CAMPETTI_DEMO: Campetto[] = [
  { id: "ruffini", nome: "Parco Ruffini — Campo 2", indirizzo: "Corso Trapani 32", citta: "Torino", superficie: "Asfalto", illuminato: true, coperto: false, canestri: 2, gratuito: true, rating: 4.6, recensioni: 23, distanzaKm: 1.2, ultimaTappa: "2026-09-14", x: 28, y: 42 },
  { id: "giardini-reali", nome: "Giardini Reali — Playground", indirizzo: "Viale Primo Maggio", citta: "Torino", superficie: "Cemento", illuminato: true, coperto: false, canestri: 2, gratuito: true, rating: 4.8, recensioni: 41, distanzaKm: 2.4, ultimaTappa: "2026-08-30", x: 56, y: 30 },
  { id: "dora", nome: "Parco Dora — Le Arcate", indirizzo: "Via Nole / Corso Mortara", citta: "Torino", superficie: "Sintetico", illuminato: true, coperto: true, canestri: 4, gratuito: true, rating: 4.9, recensioni: 58, distanzaKm: 3.1, ultimaTappa: "2026-07-20", x: 40, y: 18 },
  { id: "piazza-armi", nome: "Piazza d'Armi — Spazio 3x3", indirizzo: "Corso Galileo Ferraris", citta: "Torino", superficie: "Asfalto", illuminato: false, coperto: false, canestri: 2, gratuito: true, rating: 4.1, recensioni: 12, distanzaKm: 3.8, x: 22, y: 66 },
  { id: "vanchiglia", nome: "Campo Vanchiglia", indirizzo: "Lungo Po Antonelli", citta: "Torino", superficie: "Cemento", illuminato: true, coperto: false, canestri: 2, gratuito: false, rating: 4.3, recensioni: 19, distanzaKm: 4.5, ultimaTappa: "2026-06-08", x: 72, y: 52 },
  { id: "colletta", nome: "Parco Colletta — Campo A", indirizzo: "Via Carcano", citta: "Torino", superficie: "Asfalto", illuminato: true, coperto: false, canestri: 2, gratuito: true, rating: 3.9, recensioni: 8, distanzaKm: 5.2, x: 80, y: 24 },
];
