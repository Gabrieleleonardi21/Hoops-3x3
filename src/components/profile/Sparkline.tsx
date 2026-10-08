/** Grafico a barre SVG inline (nessuna libreria): una barra per partita.
 *  Barre arancio, valore massimo evidenziato, asse nascosto: serve a leggere il trend, non i valori esatti. */
export function Sparkline({ values, height = 56, label }: { values: number[]; height?: number; label: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 100; // viewBox in unità relative: la larghezza reale è del contenitore
  // Lo spazio di ogni barra e, dentro, lo stacco dalla successiva: al più 1.5, ma mai oltre un quarto dello spazio, così la barra
  // resta larga almeno tre quarti anche con centinaia di partite (con uno stacco fisso oltre le 67 la larghezza diventava negativa)
  const passo = w / values.length;
  const gap = Math.min(1.5, passo / 4);
  const bw = passo - gap;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}
      role="img" aria-label={`${label}: ${values.join(", ")}`}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 4));
        const top = v === max ? "var(--color-gold)" : "var(--color-court)";
        return <rect key={i} x={i * passo} y={height - h} width={bw} height={h} fill={top} rx={0.5} />;
      })}
    </svg>
  );
}
