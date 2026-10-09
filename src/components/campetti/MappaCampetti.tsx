/** La mappa dei campetti (D1): un'immagine della Maps Static API inquadrata sui soli campetti mostrati, con sopra i pin disegnati
 *  dall'app (proiezione Web Mercator di utils/geo): nessuno script esterno, la Content-Security-Policy non cambia (`img-src https:`).
 *  Senza chiave, o se l'immagine non carica (rete, quota, restrizioni della chiave), al suo posto c'è la griglia schematica con gli
 *  stessi pin: la pagina resta usabile. La posizione dell'utente non lascia il browser: non entra nell'URL (centro e zoom dipendono dai
 *  campetti) e il suo segno lo disegna l'app (D7). */
import { useState, type MouseEvent } from "react";
import type { Campetto } from "../../types/campetto";
import { coordinateDa, inquadra, proietta, type Coordinate } from "../../utils/geo";
import { Icon } from "../ui/Icon";

/** Lato dell'immagine chiesta a Google (`size=640x640`, il massimo della Static API) e del sistema di coordinate in cui lavorano
 *  `proietta` e `coordinateDa`: i pin si posizionano in percentuale di questo lato, così valgono a qualunque misura la mappa sia
 *  disegnata nella pagina. `scale=2` raddoppia solo i pixel fisici (schermi retina) e non tocca le coordinate */
const LATO = 640;
const STATIC_MAP = "https://maps.googleapis.com/maps/api/staticmap";

interface Props {
  campetti: Campetto[];
  /** Id del campetto evidenziato (pin più grande e `aria-pressed`) */
  selezionato: string | null;
  onSeleziona: (id: string) => void;
  /** Dove sta chi guarda, se ha concesso la posizione: solo per il suo segno sulla mappa */
  posizioneUtente?: Coordinate;
  /** Un clic sulla mappa fuori dai pin, con le coordinate del punto (per dare la posizione a un campetto nuovo, D4) */
  onClicMappa?: (punto: Coordinate) => void;
}

/** L'URL dell'immagine: niente `markers` (i pin li disegna l'app, e Google non deve sapere dove sono i campetti né l'utente) */
function urlImmagine(centro: Coordinate, zoom: number, chiave: string): string {
  const p = new URLSearchParams({ center: `${centro.lat},${centro.lng}`, zoom: String(zoom), size: `${LATO}x${LATO}`, scale: "2", key: chiave });
  return `${STATIC_MAP}?${p.toString()}`;
}

/** Le coordinate di un punto in pixel dell'immagine, in percentuale del lato: lo stile dei pin */
function posizione(x: number, y: number) {
  return { left: `${(x / LATO) * 100}%`, top: `${(y / LATO) * 100}%` };
}

/** La griglia schematica: strade e isoipse decorative, senza significato (è `aria-hidden`); i pin stanno sopra */
function Griglia() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {[15, 35, 55, 75, 95].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--color-asphalt-700)" strokeWidth="0.3" />)}
      {[12, 30, 48, 66, 84].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="var(--color-asphalt-700)" strokeWidth="0.3" />)}
      <path d="M60 0 C 62 30, 70 60, 78 100" fill="none" stroke="var(--color-asphalt-600)" strokeWidth="1.2" />
      <path d="M0 58 C 30 52, 60 66, 100 60" fill="none" stroke="var(--color-asphalt-600)" strokeWidth="0.8" />
    </svg>
  );
}

export function MappaCampetti({ campetti, selezionato, onSeleziona, posizioneUtente, onClicMappa }: Props) {
  // Letta a ogni render e non una volta per modulo: nei test cambia da un caso all'altro (vi.stubEnv)
  const chiave = import.meta.env.MAPS_API_KEY ?? "";
  // L'URL la cui immagine non ha caricato: con un'inquadratura nuova (altri campetti) l'URL cambia e si riprova da sé
  const [urlRotto, setUrlRotto] = useState<string | null>(null);
  const { centro, zoom } = inquadra(campetti, LATO);
  let url: string | null = null;
  if (chiave) url = urlImmagine(centro, zoom, chiave);
  const conImmagine = url !== null && url !== urlRotto;

  // Il segno dell'utente solo se cade nell'immagine: l'inquadratura segue i campetti, e un utente lontano (Roma, con i campetti
  // di Torino) finirebbe fuori, nascosto dall'overflow ma letto dal lettore di schermo
  let segnoUtente: { x: number; y: number } | null = null;
  if (posizioneUtente) {
    const p = proietta(posizioneUtente.lat, posizioneUtente.lng, centro, zoom, LATO);
    if (p.x >= 0 && p.x <= LATO && p.y >= 0 && p.y <= LATO) segnoUtente = p;
  }

  /** Un clic sul livello della mappa: i clic sui pin (pulsanti) hanno il loro gestore e qui non contano. Il punto cliccato si riporta
   *  dai pixel dello schermo al sistema 640 con il rettangolo disegnato (la mappa nella pagina non è larga 640) */
  const clic = (e: MouseEvent<HTMLDivElement>) => {
    if (!onClicMappa) return;
    if ((e.target as Element).closest("button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * LATO;
    const y = ((e.clientY - r.top) / r.height) * LATO;
    onClicMappa(coordinateDa(x, y, centro, zoom, LATO));
  };

  return (
    // presentation: il livello raccoglie i clic che arrivano dai figli e dallo sfondo; i pin restano pulsanti veri
    <div role="presentation" onClick={clic} className="relative aspect-square w-full overflow-hidden rounded border border-asphalt-700 bg-asphalt-900">
      {/* Niente referrerPolicy="no-referrer": la restrizione per referrer della chiave, in Google Cloud, legge proprio il Referer, e senza
          l'immagine risponderebbe 403. La Referrer-Policy del sito (strict-origin-when-cross-origin) manda la sola origine, che basta */}
      {conImmagine && (
        <img src={url ?? undefined} alt="Mappa della zona dei campetti mostrati" onError={() => setUrlRotto(url)}
          className="absolute inset-0 h-full w-full object-cover" />
      )}
      {!conImmagine && <Griglia />}
      {campetti.map((c) => {
        const sel = c.id === selezionato;
        const { x, y } = proietta(c.lat, c.lng, centro, zoom, LATO);
        // Il selezionato è più grande, sopra gli altri e del colore d'accento; gli altri si ingrandiscono al passaggio del puntatore
        let classe = "hover:scale-110";
        let colore = "text-chalk";
        let riempimento = "var(--color-asphalt-800)";
        if (sel) {
          classe = "z-10 scale-125";
          colore = "text-court";
          riempimento = "var(--color-court)";
        }
        return (
          <button key={c.id} type="button" onClick={() => onSeleziona(c.id)} aria-label={c.nome} aria-pressed={sel}
            className={`absolute -translate-x-1/2 -translate-y-full transition-transform ${classe}`} style={posizione(x, y)}>
            <Icon name="pin" size={28} className={colore} fill={riempimento} />
          </button>
        );
      })}
      {segnoUtente && (
        <span className="pointer-events-none absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-chalk/40"
          style={posizione(segnoUtente.x, segnoUtente.y)}>
          <span className="block h-2 w-2 rounded-full bg-chalk ring-2 ring-asphalt-950" />
          <span className="sr-only">La tua posizione</span>
        </span>
      )}
      {!conImmagine && (
        <div className="absolute bottom-2 left-2 rounded-sm bg-asphalt-950/80 px-2 py-1 text-[10.5px] uppercase tracking-[0.08em] text-chalk-dim">
          Mappa schematica
        </div>
      )}
    </div>
  );
}
