import { useEffect, useMemo, useState } from "react";
import { archivioApi } from "../services/archivioApi";
import { testoErrore } from "../services/api";
import { useAppStore } from "../stores/useAppStore";
import { unisciTappe } from "../utils/statGiocatori";
import type { PubTappa, Tappa } from "../types";

/** Le tappe su cui calcolare le statistiche dei giocatori: quelle pubblicate nell'Archivio circuito (pubbliche, uguali per ospite,
 *  USER e ADMIN) più quelle della lega aperta. Lo usano la scheda «Statistiche stagione» e la pagina del giocatore, così i loro
 *  numeri coincidono. La richiesta parte quando il componente che lo usa si monta (porta tutte le tappe pubblicate: non va chiesta
 *  a ogni visita dell'anagrafe). `tappe` è null finché l'archivio non ha risposto; se fallisce resta null e `errore` dice perché:
 *  un archivio che non si è potuto leggere non è un archivio senza statistiche. `reload` ritenta (il «Riprova»). */
export function useStatisticheCircuito(): { tappe: Tappa[] | null; errore: string | null; reload: () => void } {
  const locali = useAppStore((s) => s.tappe);
  const [pubblicate, setPubblicate] = useState<PubTappa[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const reload = async () => {
    setErrore(null);
    try {
      setPubblicate(await archivioApi.tappe());
    } catch (e) {
      setErrore(testoErrore(e));
    }
  };

  useEffect(() => { void reload(); }, []);

  // L'unione si rifà solo se cambia una delle due fonti: StatsCircuito e la pagina del giocatore ci calcolano sopra
  const tappe = useMemo(() => {
    if (pubblicate === null) return null;
    return unisciTappe(pubblicate.map((p) => p.tappa), locali);
  }, [pubblicate, locali]);

  return { tappe, errore, reload };
}
