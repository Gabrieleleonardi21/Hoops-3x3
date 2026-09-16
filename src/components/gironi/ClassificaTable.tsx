/** Tabella classifica di un girone: G=gare, V=vinte, P=perse, PF=punti fatti, PS=punti subiti.
 *  Wrapper della StandingsTable riutilizzabile con la nota sui criteri di ordinamento. */
import type { StandingRow } from "../../utils/standings";
import { StandingsTable } from "../leaderboard/StandingsTable";

export function ClassificaTable({ rows, logos, caption }: {
  rows: StandingRow[]; logos?: Record<string, string | undefined>; caption?: string;
}) {
  return (
    <div className="mt-3">
      <StandingsTable rows={rows} logos={logos} caption={caption} compact />
      <p className="mt-1.5 text-[11px] text-chalk-dim">
        Ordinamento: vittorie, poi punti fatti, poi differenza punti (criteri FIBA 3x3 semplificati).
      </p>
    </div>
  );
}
