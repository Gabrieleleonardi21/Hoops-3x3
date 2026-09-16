/** Card con la top 5 di una categoria statistica (punti, rimbalzi, assist…).
 *  Mostra il totale e la media a partita tra parentesi; il primo è in oro. */
import type { LeaderRow } from "../../utils/tappaLeaders";
import type { StatLine } from "../../types";

export function LeaderCard({ label, statKey, players }: {
  label: string; statKey: keyof StatLine; players: LeaderRow[];
}) {
  const top = [...players].filter((p) => p[statKey] > 0).sort((a, b) => b[statKey] - a[statKey] || b.pt - a.pt).slice(0, 5);
  if (!top.length) return null;
  return (
    <div className="rounded border border-asphalt-700 bg-asphalt-900">
      <div className="border-b border-asphalt-700 px-3 py-2 font-display text-base text-chalk">{label}</div>
      <ol className="px-3 py-1.5">
        {top.map((p, i) => {
          const first = i === 0;
          return (
            <li key={p.pid} className="flex items-baseline gap-2 py-1.5 border-b border-asphalt-700/60 last:border-b-0">
              <span className={`w-4 font-display text-sm ${first ? "text-gold" : "text-chalk-dim"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-chalk">{p.nome}</span>
                <span className="block truncate text-[11px] text-chalk-muted">{p.squadra}</span>
              </span>
              <span className={`font-display text-xl ${first ? "text-gold" : "text-chalk"}`}>
                {p[statKey]}
                <span className="ml-1 font-sans text-[10.5px] font-medium text-chalk-muted">({(p[statKey] / p.g).toFixed(1)})</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
