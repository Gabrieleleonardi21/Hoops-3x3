/** Grafico a barre SVG inline (nessuna libreria): una barra per partita.
 *  Barre arancio, valore massimo evidenziato, asse nascosto: serve a leggere il trend, non i valori esatti. */
export function Sparkline({ values, height = 56, label }: { values: number[]; height?: number; label: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 100; // viewBox in unità relative: la larghezza reale è del contenitore
  const gap = 1.5;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}
      role="img" aria-label={`${label}: ${values.join(", ")}`}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 4));
        const top = v === max ? "var(--color-gold)" : "var(--color-court)";
        return <rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} fill={top} rx={0.5} />;
      })}
    </svg>
  );
}
