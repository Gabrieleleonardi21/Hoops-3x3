/** La posizione dell'utente dalla Geolocation API del browser, solo quando la chiede lui con `chiedi()` (D7): mai all'apertura della
 *  pagina, così il browser non mostra la richiesta di permesso a chi non l'ha voluta. La posizione resta in memoria nel browser: chi
 *  la usa (la pagina dei Campetti) la manda al nostro server solo come centro della ricerca per raggio, mai a Google. */
import { useEffect, useRef, useState } from "react";
import type { Coordinate } from "../utils/geo";

export type StatoPosizione = "mai chiesta" | "in corso" | "concessa" | "negata" | "non disponibile";

/** Tempo massimo di attesa del browser (ms): oltre, l'errore è TIMEOUT e la pagina resta usabile senza posizione */
const TEMPO_MASSIMO = 10_000;
/** Una lettura di pochi minuti fa va bene: i campetti non si spostano, e la lettura fresca costa tempo e batteria */
const ETA_MASSIMA = 5 * 60_000;
/** `code` dell'errore della Geolocation API quando l'utente (o il sistema) ha negato il permesso; 2 è POSITION_UNAVAILABLE, 3 TIMEOUT */
const PERMESSO_NEGATO = 1;

export function usePosizione(): { stato: StatoPosizione; posizione: Coordinate | null; chiedi: () => void } {
  const [stato, setStato] = useState<StatoPosizione>("mai chiesta");
  const [posizione, setPosizione] = useState<Coordinate | null>(null);
  // La risposta del browser può arrivare dopo che la pagina è stata lasciata: non si aggiorna uno stato smontato
  const montato = useRef(true);
  useEffect(() => {
    montato.current = true;
    return () => { montato.current = false; };
  }, []);

  const chiedi = () => {
    // Browser senza l'API (o contesto non sicuro, dove il browser la nasconde): lo stesso esito di una posizione che non arriva
    if (!navigator.geolocation) {
      setStato("non disponibile");
      return;
    }
    setStato("in corso");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!montato.current) return;
        setPosizione({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStato("concessa");
      },
      (e) => {
        if (!montato.current) return;
        if (e.code === PERMESSO_NEGATO) setStato("negata");
        else setStato("non disponibile");
      },
      { timeout: TEMPO_MASSIMO, maximumAge: ETA_MASSIMA },
    );
  };

  return { stato, posizione, chiedi };
}
