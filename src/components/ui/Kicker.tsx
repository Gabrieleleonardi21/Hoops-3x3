/** Etichetta piccola maiuscola sopra sezioni e colonne (stessa resa della classe .kicker). */
export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`kicker ${className}`}>{children}</div>;
}
