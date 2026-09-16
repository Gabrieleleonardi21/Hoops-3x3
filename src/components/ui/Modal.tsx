/** Modale base: overlay + card con intestazione (titolo, sottotitolo, chiudi). Chiude al clic
 *  sull'overlay e con Esc; blocca lo scroll della pagina tramite useScrollLock. */
import { useEffect } from "react";
import { useScrollLock } from "../../hooks/useScrollLock";
import { Icon } from "./Icon";

export function Modal({ title, subtitle, label, width = 480, onClose, children }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; label: string; width?: number;
  onClose: () => void; children: React.ReactNode;
}) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}
        className="modal-card flex max-h-[88vh] w-full flex-col" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-3 border-b border-asphalt-700 px-5 py-3">
          <div className="min-w-0">
            {title && <div className="font-display text-2xl text-chalk">{title}</div>}
            {subtitle && <div className="text-xs font-semibold text-court">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="shrink-0 text-chalk-muted hover:text-chalk" aria-label="Chiudi"><Icon name="close" size={20} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
