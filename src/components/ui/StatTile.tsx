/** Tile statistica: kicker + numero grande + riga secondaria (media, nome giocatore…).
 *  `highlight` usa l'oro per il primo posto / MVP. */
export function StatTile({ label, value, sub, meta, highlight }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; meta?: React.ReactNode; highlight?: boolean;
}) {
  const valueCls = highlight ? "text-gold" : "text-chalk";
  return (
    <div className="bg-asphalt-900 border border-asphalt-700 rounded p-3 min-w-0">
      <div className="kicker mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`font-display text-4xl leading-none ${valueCls}`}>{value}</span>
        {sub && <span className="text-xs text-chalk-muted font-medium">{sub}</span>}
      </div>
      {meta && <div className="mt-2 text-[13px] text-chalk truncate">{meta}</div>}
    </div>
  );
}
