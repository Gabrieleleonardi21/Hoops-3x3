import { useEffect, useEffectEvent, useRef } from "react";

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
