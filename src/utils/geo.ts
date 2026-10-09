/** Geometria dei campetti: distanze in linea d'aria e la proiezione Web Mercator con cui l'app disegna i pin sopra l'immagine della
 *  Maps Static API (tile di 256 px: a zoom z il mondo è largo 256·2^z px). Funzioni pure, senza stato: il frontend lavora nel sistema
 *  `size` dell'immagine (640×640), il parametro `scale` dell'API raddoppia solo i pixel fisici e qui non c'entra. */
import { fmtMedia } from "./formato";

export interface Coordinate { lat: number; lng: number }
/** Posizione in pixel dentro l'immagine, dall'angolo in alto a sinistra */
export interface Punto { x: number; y: number }
export interface Inquadratura { centro: Coordinate; zoom: number }

/** Raggio medio della Terra (km), quello della formula di Haversine */
const RAGGIO_TERRA_KM = 6371;
/** Lato di un tile della mappa (px): la base della proiezione a zoom 0 */
const TILE = 256;
/** Zoom della Maps Static API tra cui si sceglie l'inquadratura: sotto 1 il mondo è più piccolo dell'immagine, sopra 18 non si
 *  distingue più niente in un campetto */
const ZOOM_MIN = 1;
const ZOOM_MAX = 18;
/** Zoom per un solo campetto: il quartiere intorno, non il campo da solo */
const ZOOM_SINGOLO = 15;
/** Frazione del lato lasciata libera da ogni bordo quando si inquadrano più punti: i pin ai margini resterebbero tagliati (il pin è
 *  disegnato sopra il punto) */
const MARGINE = 0.1;
/** Inquadratura senza campetti: il centro di Roma, dove la pagina si apre (contratto della fase 5), con la città intera in vista */
const ROMA: Coordinate = { lat: 41.9028, lng: 12.4964 };
const ZOOM_ROMA = 12;

const inRadianti = (gradi: number) => (gradi * Math.PI) / 180;
const inGradi = (radianti: number) => (radianti * 180) / Math.PI;

/** Distanza in linea d'aria (km) con la formula di Haversine: a = sin²(Δφ/2) + cos φ₁·cos φ₂·sin²(Δλ/2), d = 2R·asin(√a).
 *  Sulla sfera, non sull'ellissoide: lo scarto (sotto lo 0,5%) non conta per dire quanto dista un campetto. */
export function distanzaKm(a: Coordinate, b: Coordinate): number {
  const dLat = inRadianti(b.lat - a.lat);
  const dLng = inRadianti(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(inRadianti(a.lat)) * Math.cos(inRadianti(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAGGIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

/** La distanza per l'utente: in metri sotto il chilometro («850 m»), altrimenti con un decimale e la virgola italiana («1,2 km») */
export function fmtDistanza(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${fmtMedia(km)} km`;
}

/** Larghezza del mondo in pixel allo zoom dato */
const mondo = (zoom: number) => TILE * 2 ** zoom;

/** Coordinate del mondo (px, origine in alto a sinistra: lng −180, lat +85) di un punto a uno zoom. Web Mercator:
 *  x = (λ + 180) / 360 · mondo, y = (1 − ln(tan φ + sec φ) / π) / 2 · mondo. */
function nelMondo(lat: number, lng: number, zoom: number): Punto {
  const fi = inRadianti(lat);
  return {
    x: ((lng + 180) / 360) * mondo(zoom),
    y: ((1 - Math.log(Math.tan(fi) + 1 / Math.cos(fi)) / Math.PI) / 2) * mondo(zoom),
  };
}

/** Pixel di un punto dentro un'immagine quadrata di lato `dimensione` centrata su `centro` allo zoom dato: la differenza tra le
 *  coordinate del mondo del punto e quelle del centro, spostata al centro dell'immagine */
export function proietta(lat: number, lng: number, centro: Coordinate, zoom: number, dimensione: number): Punto {
  const p = nelMondo(lat, lng, zoom);
  const c = nelMondo(centro.lat, centro.lng, zoom);
  return { x: p.x - c.x + dimensione / 2, y: p.y - c.y + dimensione / 2 };
}

/** L'inversa di `proietta`: le coordinate del punto sotto un pixel dell'immagine (un clic sulla mappa).
 *  λ = x / mondo · 360 − 180, φ = atan(sinh(π · (1 − 2y / mondo))). */
export function coordinateDa(x: number, y: number, centro: Coordinate, zoom: number, dimensione: number): Coordinate {
  const c = nelMondo(centro.lat, centro.lng, zoom);
  const px = c.x + x - dimensione / 2;
  const py = c.y + y - dimensione / 2;
  return {
    lat: inGradi(Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / mondo(zoom))))),
    lng: (px / mondo(zoom)) * 360 - 180,
  };
}

/** Centro e zoom che contengono tutti i punti in un'immagine quadrata di lato `dimensione`: il centro è quello del riquadro dei
 *  punti; lo zoom è il più grande intero, tra ZOOM_MIN e ZOOM_MAX, con cui tutti i punti stanno dentro il margine. Senza punti
 *  Roma allo zoom 12; con un solo punto (o tutti nello stesso posto il riquadro non ha misura) lo zoom del quartiere. */
export function inquadra(punti: Coordinate[], dimensione: number): Inquadratura {
  if (punti.length === 0) return { centro: ROMA, zoom: ZOOM_ROMA };
  if (punti.length === 1) return { centro: punti[0], zoom: ZOOM_SINGOLO };
  const lat = punti.map((p) => p.lat);
  const lng = punti.map((p) => p.lng);
  const centro = { lat: (Math.min(...lat) + Math.max(...lat)) / 2, lng: (Math.min(...lng) + Math.max(...lng)) / 2 };
  const bordo = dimensione * MARGINE;
  const dentro = (p: Coordinate, zoom: number) => {
    const { x, y } = proietta(p.lat, p.lng, centro, zoom, dimensione);
    return x >= bordo && x <= dimensione - bordo && y >= bordo && y <= dimensione - bordo;
  };
  // Dal più vicino al più lontano: il primo zoom che li contiene tutti è il massimo possibile
  for (let zoom = ZOOM_MAX; zoom > ZOOM_MIN; zoom--) {
    if (punti.every((p) => dentro(p, zoom))) return { centro, zoom };
  }
  return { centro, zoom: ZOOM_MIN };
}
