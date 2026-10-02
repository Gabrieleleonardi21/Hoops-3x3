/** Testo di caricamento con pulsazione (rispetta prefers-reduced-motion via CSS globale). */
export function Loading({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-chalk-muted pulse">{children}</p>;
}
