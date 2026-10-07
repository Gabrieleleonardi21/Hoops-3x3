/** Testo di caricamento con pulsazione (rispetta prefers-reduced-motion via CSS globale). role="status": il lettore di schermo
 *  annuncia che si sta caricando, senza spostare il focus. */
export function Loading({ children }: { children: React.ReactNode }) {
  return <p role="status" className="text-sm font-semibold text-chalk-muted pulse">{children}</p>;
}
