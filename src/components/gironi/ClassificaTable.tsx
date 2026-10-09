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
      {/* I criteri sono quelli di utils/standings (art. 13 del regolamento FIBA 3x3): la nota li descrive, non li decide */}
      <p className="mt-1.5 text-[11px] text-chalk-dim">
        Ordinamento: vittorie; a pari vittorie contano le vittorie negli scontri diretti (le partite giocate tra le
        squadre in parità); chi resta a pari passa alla media dei punti fatti per gara in tutto il girone, poi
        all'ordine delle teste di serie (regolamento FIBA 3x3, art. 13: ogni criterio una volta sola).
      </p>
    </div>
  );
}
