import { useEffect, useEffectEvent, useRef } from "react";
import { raggiungibili } from "./usePilaFinestre";

/** Il focus di una finestra (una modale, il pannello del Coach): all'apertura va dove dice `dove` (null: non si sposta), alla chiusura
 *  torna a ciò che lo aveva prima, di solito il pulsante che l'ha aperta. Si rimette solo se il focus è finito nel vuoto, cioè su body
 *  perché l'elemento che lo teneva è sparito con la finestra: se l'utente l'ha già portato altrove (il pannello del Coach non è
 *  modale e lascia usare la pagina sotto) non glielo si toglie. Se il pulsante di prima non c'è più (la voce eliminata dalla finestra)
 *  il focus resta dov'è. */
export function useFocusFinestra(dove: () => HTMLElement | null) {
  // Effect Event: l'effetto parte solo all'apertura e alla chiusura, ma `dove` legge le ref come sono in quel momento
  const atterra = useEffectEvent(dove);
  // Chi aveva il focus all'apertura, in una ref: in StrictMode (sviluppo) React smonta e rimonta l'effetto subito, e al secondo giro il
  // focus è già dentro la finestra, quindi `document.activeElement` non è più chi l'ha aperta
  const apertaDa = useRef<Element | null | undefined>(undefined);
  useEffect(() => {
    if (apertaDa.current === undefined) apertaDa.current = document.activeElement;
    atterra()?.focus();
    return () => {
      const prima = apertaDa.current;
      if (document.activeElement === document.body && prima instanceof HTMLElement && prima.isConnected) prima.focus();
    };
  }, []);
}

/** La scheda che passa dalla vista dei dati al form di modifica e ritorno: il pulsante premuto sparisce con la sua vista, e il focus
 *  cadrebbe su body. Entrando in modifica va al primo campo del form (`form` è la ref del suo contenitore); uscendone («Annulla» o un
 *  salvataggio riuscito) torna al primo pulsante delle azioni (`azioni` è la ref del loro contenitore), cioè «Modifica». */
export function useFocusModifica(editing: boolean) {
  const form = useRef<HTMLDivElement>(null);
  const azioni = useRef<HTMLDivElement>(null);
  // Se al ridisegno prima la scheda era in modifica: al primo disegno non c'è niente da cui uscire, e il focus resta dov'è
  const eraInModifica = useRef(false);
  useEffect(() => {
    if (editing && form.current) raggiungibili(form.current)[0]?.focus();
    if (!editing && eraInModifica.current && azioni.current) raggiungibili(azioni.current)[0]?.focus();
    eraInModifica.current = editing;
  }, [editing]);
  return { form, azioni };
}
