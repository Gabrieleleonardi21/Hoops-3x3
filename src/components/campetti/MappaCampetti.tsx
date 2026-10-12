/** La mappa dei campetti: Leaflet con le tessere di OpenStreetMap (© OpenStreetMap contributors). Si trascina e si ingrandisce; ogni
 *  campetto è un pulsante sulla mappa (con Tab, Invio e Spazio); un clic sullo sfondo dà le coordinate del punto, e il pin provvisorio
 *  (il punto del campetto che si sta compilando) si trascina per correggerlo.
 *  Perché OpenStreetMap con Leaflet e non Google Maps: README, «Campetti». Niente chiave nel browser, niente script esterni: il bundle
 *  porta Leaflet e il CSS, e le tessere arrivano da `img-src https:` della Content-Security-Policy, che non cambia. I pin sono costruiti
 *  con le API del DOM (niente innerHTML con i nomi dei campetti, che scrive chi li inserisce). */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Campetto } from "../../types/campetto";
import type { Coordinate } from "../../utils/geo";

/** Centro e zoom della mappa senza campetti: Roma, dove la pagina si apre (contratto della fase 5) */
const ROMA: Coordinate = { lat: 41.9028, lng: 12.4964 };
const ZOOM_ROMA = 12;
/** Lo zoom massimo quando si adatta la vista ai campetti: un solo campetto non porta il quartiere sul campo */
const ZOOM_MASSIMO_ADATTA = 15;
/** Le tessere di OpenStreetMap, sui tre sottodomini; l'uso è gratuito con attribuzione (vedi la politica di OSM nel README) */
const TESSERE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
/** L'attribuzione è obbligatoria: il testo è costante, non dati di utenti */
const ATTRIBUZIONE = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** Il percorso del pin: lo stesso disegno dell'icona `pin` di ui/Icon.tsx (lì è in una tabella non esportata) */
const PERCORSO_PIN = "M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z";
const SVG_NS = "http://www.w3.org/2000/svg";

/** Il pin disegnato con le API del DOM: un SVG 24×24 con il percorso di `PERCORSO_PIN`, della dimensione data */
function pinSvg(dimensione: number, riempimento: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(dimensione));
  svg.setAttribute("height", String(dimensione));
  svg.setAttribute("fill", riempimento);
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const percorso = document.createElementNS(SVG_NS, "path");
  percorso.setAttribute("d", PERCORSO_PIN);
  svg.append(percorso);
  return svg;
}

/** Un testo per chi legge lo schermo, nascosto alla vista (come la classe `sr-only` di Tailwind) */
function testoSoloSchermo(testo: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "sr-only";
  span.textContent = testo;
  return span;
}

/** Icona vuota di Leaflet: il contenuto lo aggiunge il codice con le API del DOM (un `divIcon` senza `html` non usa innerHTML) */
function iconaVuota(dimensione: number): L.DivIcon {
  return L.divIcon({ className: "", iconSize: [dimensione, dimensione], iconAnchor: [dimensione / 2, dimensione] });
}

interface Props {
  campetti: Campetto[];
  /** Id del campetto evidenziato (pin più grande e `aria-pressed`) */
  selezionato: string | null;
  onSeleziona: (id: string) => void;
  /** Dove sta chi guarda, se ha concesso la posizione: solo per il suo segno sulla mappa */
  posizioneUtente?: Coordinate;
  /** Un clic sulla mappa, o il rilascio del pin provvisorio trascinato, con le coordinate del punto (per dare la posizione a un campetto
   *  nuovo, D4) */
  onClicMappa?: (punto: Coordinate) => void;
  /** La posizione scelta per il campetto che si sta compilando (form): un pin trascinabile, del colore d'accento */
  pinProvvisorio?: Coordinate;
}

export function MappaCampetti({ campetti, selezionato, onSeleziona, posizioneUtente, onClicMappa, pinProvvisorio }: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const mappaRef = useRef<L.Map | null>(null);
  // I gruppi di segni: si svuotano e si ridisegnano senza toccare la mappa
  const gruppoPin = useRef<L.LayerGroup | null>(null);
  const gruppoProvvisorio = useRef<L.LayerGroup | null>(null);
  const gruppoUtente = useRef<L.LayerGroup | null>(null);
  // Le funzioni dei gestori come sono all'ultimo render: la mappa è creata una volta sola e non si ricrea a ogni render
  const onSelezionaRef = useRef(onSeleziona);
  const onClicMappaRef = useRef(onClicMappa);
  const campettiRef = useRef(campetti);
  useEffect(() => {
    onSelezionaRef.current = onSeleziona;
    onClicMappaRef.current = onClicMappa;
    campettiRef.current = campetti;
  });

  // La mappa: una volta sola, con le tessere di OpenStreetMap e l'attribuzione; un clic sullo sfondo dà le coordinate del punto
  useEffect(() => {
    if (!contenitore.current) return;
    const mappa = L.map(contenitore.current, { zoomControl: true, attributionControl: true });
    mappaRef.current = mappa;
    L.tileLayer(TESSERE, { attribution: ATTRIBUZIONE, maxZoom: 19, subdomains: "abc" }).addTo(mappa);
    mappa.setView([ROMA.lat, ROMA.lng], ZOOM_ROMA);
    gruppoPin.current = L.layerGroup().addTo(mappa);
    gruppoProvvisorio.current = L.layerGroup().addTo(mappa);
    gruppoUtente.current = L.layerGroup().addTo(mappa);
    mappa.on("click", (e: L.LeafletMouseEvent) => onClicMappaRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => {
      mappa.remove();
      mappaRef.current = null;
    };
  }, []);

  // I pin dei campetti: un pulsante per campetto, con il nome per chi legge lo schermo e aria-pressed sul selezionato
  useEffect(() => {
    const gruppo = gruppoPin.current;
    if (!gruppo) return;
    gruppo.clearLayers();
    for (const c of campetti) {
      const sel = c.id === selezionato;
      const marker = L.marker([c.lat, c.lng], { icon: iconaVuota(28), keyboard: false });
      marker.addTo(gruppo);
      const contenitoreIcona = marker.getElement();
      if (!contenitoreIcona) continue;
      const bottone = document.createElement("button");
      bottone.type = "button";
      bottone.setAttribute("aria-label", c.nome);
      bottone.setAttribute("aria-pressed", String(sel));
      // Il selezionato è più grande e del colore d'accento; gli altri si ingrandiscono al passaggio del puntatore
      bottone.className = sel
        ? "block h-7 w-7 scale-125 p-0 text-court transition-transform"
        : "block h-7 w-7 p-0 text-chalk transition-transform hover:scale-110";
      bottone.append(pinSvg(28, sel ? "var(--color-court)" : "var(--color-asphalt-800)"));
      // Il clic sul pin non deve arrivare alla mappa (Leaflet lo leggerebbe come clic sullo sfondo, con le coordinate del pin)
      bottone.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelezionaRef.current(c.id);
      });
      contenitoreIcona.append(bottone);
    }
  }, [campetti, selezionato]);

  // Il pin provvisorio: trascinabile; quando lo si rilascia, la nuova posizione va a chi compila il form (il punto si corregge lì)
  const provvisorioLat = pinProvvisorio?.lat;
  const provvisorioLng = pinProvvisorio?.lng;
  useEffect(() => {
    const gruppo = gruppoProvvisorio.current;
    if (!gruppo) return;
    gruppo.clearLayers();
    if (provvisorioLat === undefined || provvisorioLng === undefined) return;
    const marker = L.marker([provvisorioLat, provvisorioLng], { icon: iconaVuota(32), draggable: true, keyboard: false });
    marker.on("dragend", () => {
      const punto = marker.getLatLng();
      onClicMappaRef.current?.({ lat: punto.lat, lng: punto.lng });
    });
    marker.addTo(gruppo);
    const contenitoreIcona = marker.getElement();
    if (!contenitoreIcona) return;
    contenitoreIcona.classList.add("text-court");
    contenitoreIcona.append(pinSvg(32, "var(--color-court)"), testoSoloSchermo("Posizione scelta"));
  }, [provvisorioLat, provvisorioLng]);

  // La posizione dell'utente: un segno non interattivo con il testo per chi legge lo schermo
  const utenteLat = posizioneUtente?.lat;
  const utenteLng = posizioneUtente?.lng;
  useEffect(() => {
    const gruppo = gruppoUtente.current;
    if (!gruppo) return;
    gruppo.clearLayers();
    if (utenteLat === undefined || utenteLng === undefined) return;
    const marker = L.marker([utenteLat, utenteLng], { icon: iconaVuota(16), interactive: false, keyboard: false });
    marker.addTo(gruppo);
    const contenitoreIcona = marker.getElement();
    if (!contenitoreIcona) return;
    const punto = document.createElement("span");
    punto.className = "block h-2 w-2 rounded-full bg-chalk ring-2 ring-asphalt-950 mx-auto mt-[7px]";
    contenitoreIcona.append(punto, testoSoloSchermo("La tua posizione"));
  }, [utenteLat, utenteLng]);

  // La vista si adatta ai campetti quando cambia l'elenco (il contenuto, non l'array: il form ne crea uno nuovo a ogni render), così la
  // mappa non torna indietro mentre l'utente la sposta. Senza campetti torna su Roma
  const chiaveElenco = campetti.map((c) => `${c.id}:${c.lat},${c.lng}`).join("|");
  useEffect(() => {
    const mappa = mappaRef.current;
    if (!mappa) return;
    const punti = campettiRef.current.map((c): [number, number] => [c.lat, c.lng]);
    if (punti.length === 0) {
      mappa.setView([ROMA.lat, ROMA.lng], ZOOM_ROMA);
      return;
    }
    mappa.fitBounds(L.latLngBounds(punti), { padding: [24, 24], maxZoom: ZOOM_MASSIMO_ADATTA });
  }, [chiaveElenco]);

  return (
    <div ref={contenitore} role="region" aria-label="Mappa dei campetti"
      className="relative aspect-square w-full overflow-hidden rounded border border-asphalt-700 bg-asphalt-900" />
  );
}
