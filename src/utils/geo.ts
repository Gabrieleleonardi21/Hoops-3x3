/** Geometria dei campetti che l'app usa ancora: le distanze in linea d'aria, per l'ordine e le distanze delle card. La mappa
 *  (Leaflet) fa da sola la proiezione e l'inquadratura, quindi qui non c'è più nient'altro. Funzioni pure, senza stato. */
import { fmtMedia } from "./formato";

export interface Coordinate { lat: number; lng: number }

/** Raggio medio della Terra (km), quello della formula di Haversine */
const RAGGIO_TERRA_KM = 6371;

const inRadianti = (gradi: number) => (gradi * Math.PI) / 180;

/** Distanza in linea d'aria (km) con la formula di Haversine: a = sin²(Δφ/2) + cos φ₁·cos φ₂·sin²(Δλ/2), d = 2R·asin(√a).
 *  Sulla sfera, non sull'ellissoide: lo scarto (sotto lo 0,5%) non conta per dire quanto dista un campetto. */
export function distanzaKm(a: Coordinate, b: Coordinate): number {
  const dLat = inRadianti(b.lat - a.lat);
  const dLng = inRadianti(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(inRadianti(a.lat)) * Math.cos(inRadianti(b.lat)) * Math.sin(dLng / 2) ** 2;
  // Agli antipodi h vale 1, e per arrotondamento può superarlo di un'inezia: asin di un numero sopra 1 è NaN
  return 2 * RAGGIO_TERRA_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** La distanza per l'utente: in metri sotto il chilometro («850 m»), altrimenti con un decimale e la virgola italiana («1,2 km»).
 *  Si arrotonda ai metri prima di decidere: 999,6 m sono 1000, e si scrivono «1,0 km», non «1000 m» */
export function fmtDistanza(km: number): string {
  const metri = Math.round(km * 1000);
  if (metri < 1000) return `${metri} m`;
  return `${fmtMedia(km)} km`;
}
