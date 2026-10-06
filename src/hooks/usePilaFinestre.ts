import { useEffect, useRef, type RefObject } from "react";

/** Una finestra aperta: chi la chiude e, se è modale, l'elemento dentro cui tenere il focus */
interface Finestra {
  chiudi: RefObject<() => void>;
  contenitore?: RefObject<HTMLElement | null>;
}

// Le finestre aperte adesso, dalla più vecchia alla più recente: l'ultima è in primo piano. La pila sta a livello di modulo perché le
// finestre si aprono una sopra l'altra da componenti che non si conoscono (la conferma sopra la scheda dell'anagrafe o sopra il timer).
// L'ordine è quello in cui i componenti si montano: due finestre che si montano nello stesso istante (i figli prima dei genitori)
// avrebbero l'ordine rovesciato, ma non succede, perché la conferma si apre sempre dopo la finestra su cui sta
let pila: Finestra[] = [];

/** Gli elementi che Tab raggiunge in `contenitore`, nell'ordine del DOM. Non si controlla se sono visibili: dentro le finestre
 *  dell'app non ci sono controlli nascosti */
export function raggiungibili(contenitore: HTMLElement): HTMLElement[] {
  const candidati = contenitore.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]');
  return Array.from(candidati).filter((el) => el.tabIndex >= 0 && !el.matches(":disabled"));
}

/** Tab e Shift+Tab girano dentro `finestra`: dall'ultimo elemento si torna al primo, dal primo (o da fuori) all'ultimo. In mezzo non
 *  si interviene, il browser sa già dove andare */
function trattieniFocus(e: KeyboardEvent, finestra: HTMLElement) {
  const lista = raggiungibili(finestra);
  const primo = lista[0];
  const ultimo = lista[lista.length - 1];
  // Niente da raggiungere: il focus resta sulla finestra stessa
  if (!primo) {
    e.preventDefault();
    finestra.focus();
    return;
  }
  const attivo = document.activeElement;
  const dentro = finestra.contains(attivo);
  if (e.shiftKey && (!dentro || attivo === primo || attivo === finestra)) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && (!dentro || attivo === ultimo)) {
    e.preventDefault();
    primo.focus();
  }
}

/** L'unico ascoltatore dei tasti, per tutte le finestre: legge la pila nel momento dell'evento, quindi un tasto vale per una
 *  finestra sola. Con un ascoltatore per finestra, chiusa quella in primo piano React potrebbe smontarla prima che arrivi
 *  l'ascoltatore della finestra sotto, che si troverebbe in primo piano e chiuderebbe anche lei */
function suTasto(e: KeyboardEvent) {
  const inPrimoPiano = pila.at(-1);
  if (!inPrimoPiano) return;
  // Con Esc tenuto premuto il browser ripete l'evento: conta solo la prima pressione, che chiude la finestra in primo piano. Le
  // ripetizioni arriverebbero a quella sotto, e una sola pressione lunga chiuderebbe la conferma e poi anche la scheda
  if (e.key === "Escape" && !e.repeat) inPrimoPiano.chiudi.current();
  const contenitore = inPrimoPiano.contenitore?.current;
  if (e.key === "Tab" && contenitore) trattieniFocus(e, contenitore);
}

/** Tiene la finestra nella pila delle aperte finché il componente è montato. Esc chiude solo quella in primo piano (l'ultima aperta).
 *  Se si passa `contenitore` la finestra è modale: Tab e Shift+Tab restano dentro di lui, sempre solo per la finestra in primo piano.
 *  Senza `contenitore` (un pannello che non blocca la pagina) vale solo l'Esc.
 *  `onClose` può cambiare a ogni ridisegno (il timer ridisegna ogni 100 ms): sta in una ref, così l'Esc non si riaggancia. */
export function usePilaFinestre(onClose: () => void, contenitore?: RefObject<HTMLElement | null>) {
  const chiudi = useRef(onClose);
  useEffect(() => { chiudi.current = onClose; });

  useEffect(() => {
    const finestra: Finestra = { chiudi, contenitore };
    pila = [...pila, finestra];
    if (pila.length === 1) window.addEventListener("keydown", suTasto);
    return () => {
      // Si toglie questa finestra, non l'ultima: due finestre possono smontarsi in qualunque ordine
      pila = pila.filter((f) => f !== finestra);
      if (pila.length === 0) window.removeEventListener("keydown", suTasto);
    };
  }, [contenitore]);
}
