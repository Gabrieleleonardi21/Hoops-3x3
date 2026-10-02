import { STAT_KEYS } from "../../constants/rules";
import type { StatLine, StatSheet, GiocatoreRoster } from "../../types";

/** Tabella in sola lettura delle statistiche registrate di una squadra */
export function StatsView({ teamName, players, sheet }: {
  teamName: string; players: GiocatoreRoster[]; sheet: StatSheet;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="kicker mb-1">{teamName}</div>
      <table className="statstable">
        {/* colonne stat a larghezza fissa (44px); GIOCATORE occupa il resto */}
        <colgroup>
          <col />
          {STAT_KEYS.map(([k]) => <col key={k} style={{ width: 44 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="text-left" scope="col">Giocatore</th>
            {STAT_KEYS.map(([k, hdr]) => <th key={k} scope="col">{hdr}</th>)}
          </tr>
        </thead>
        <tbody>
          {players.filter((p) => sheet[p.id] !== undefined).map((p) => {
            const raw = sheet[p.id];
            const st: StatLine = typeof raw === "object" && raw !== null ? raw : { pt: raw as number };
            return (
              <tr key={p.id}>
                <td className="tname">{p.nome}</td>
                {STAT_KEYS.map(([k]) => <td key={k} className="font-semibold text-chalk">{st[k] ?? "—"}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
