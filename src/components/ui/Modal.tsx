/** Modale base: overlay + card con intestazione (titolo, sottotitolo, chiudi). Chiude al clic sull'overlay e con Esc (solo la modale
 *  in primo piano, vedi usePilaFinestre); blocca lo scroll della pagina tramite useScrollLock. Gestisce anche il focus: all'apertura
 *  entra nella finestra (useFocusFinestra), Tab e Shift+Tab non ne escono e alla chiusura torna a chi l'aveva aperta. */
import { useRef } from "react";
import { useFocusFinestra } from "../../hooks/useFocusFinestra";
import { raggiungibili, usePilaFinestre } from "../../hooks/usePilaFinestre";
import { useScrollLock } from "../../hooks/useScrollLock";
import { Icon } from "./Icon";

/** Dove atterra il focus all'apertura: l'elemento che il contenuto indica con `data-focus-iniziale` (il timer sceglie START),
 *  altrimenti il primo che Tab raggiunge nel contenuto (non la X dell'intestazione: con un Invio dato di riflesso chiuderebbe la
 *  finestra), altrimenti la finestra stessa */
function doveAtterra(finestra: HTMLElement, contenuto: HTMLElement): HTMLElement {
  return contenuto.querySelector<HTMLElement>("[data-focus-iniziale]") ?? raggiungibili(contenuto)[0] ?? finestra;
}

export function Modal({ title, subtitle, label, width = 480, onClose, children }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; label: string; width?: number;
  onClose: () => void; children: React.ReactNode;
}) {
  const finestra = useRef<HTMLDivElement>(null);
  const contenuto = useRef<HTMLDivElement>(null);
  useScrollLock();
  usePilaFinestre(onClose, finestra);

  useFocusFinestra(() => {
    if (!finestra.current || !contenuto.current) return null;
    return doveAtterra(finestra.current, contenuto.current);
  });

  return (
    // Lo sfondo chiude la modale al clic: è una scorciatoia solo per il mouse,
    // da tastiera ci sono Esc (sopra) e il pulsante «Chiudi» nell'intestazione
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- scorciatoia per il mouse, vedi sopra
    <div onClick={onClose} className="modal-overlay">
      {/* Il clic dentro la card non deve arrivare allo sfondo, altrimenti la chiuderebbe. tabIndex -1: la finestra può prendere il
          focus (senza entrare nell'ordine di Tab) quando dentro non c'è niente da raggiungere. Con l'anello del focus: da tastiera è
          l'unico indicatore, col mouse (un clic nella finestra la mette a fuoco) non compare */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- ferma solo la propagazione del clic */}
      <div ref={finestra} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}
        className="modal-card flex max-h-[88vh] w-full flex-col" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-3 border-b border-asphalt-700 px-5 py-3">
          <div className="min-w-0">
            {title && <div className="font-display text-2xl text-chalk">{title}</div>}
            {subtitle && <div className="text-xs font-semibold text-court">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="area-tocco shrink-0 text-chalk-muted hover:text-chalk" aria-label="Chiudi"><Icon name="close" size={20} /></button>
        </div>
        <div ref={contenuto} className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
