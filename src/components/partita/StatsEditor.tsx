import { STAT_KEYS } from "../../constants/rules";
import type { GiocatoreRoster, StatLine } from "../../types";

export type SheetDraft = Record<string, Partial<Record<keyof StatLine, string>>>;

interface Props {
  teamName: string;
  players: GiocatoreRoster[];
  sheet: SheetDraft;
  guest: boolean;
  onChange: (pid: string, key: keyof StatLine, v: string) => void;
}

/** Tabella di inserimento delle statistiche complete di una squadra */
export function StatsEditor({ teamName, players, sheet, guest, onChange }: Props) {
  const note = guest ? "facoltative da Ospite" : "punti obbligatori, il resto facoltativo";
  return (
    <div className="rounded border border-asphalt-700 bg-asphalt-950/60 p-2.5">
      <div className="kicker mb-1.5">Statistiche — {teamName} <span className="normal-case tracking-normal text-chalk-dim">({note})</span></div>
      {players.length === 0 && <p className="m-0 text-xs font-semibold text-loss">Nessun giocatore nel roster.</p>}
      {players.length > 0 && (
        <div className="overflow-x-auto">
          <table className="statstable">
            <thead>
              <tr>
                <th className="text-left" scope="col">Giocatore</th>
                {STAT_KEYS.map(([k, hdr]) => <th key={k} scope="col">{hdr}</th>)}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="tname">{p.nome}</td>
                  {STAT_KEYS.map(([k, hdr]) => (
                    <td key={k}>
                      <input className="cellin" type="number" min={0} inputMode="numeric"
                        value={sheet[p.id]?.[k] ?? ""}
                        onChange={(e) => onChange(p.id, k, e.target.value)}
                        aria-label={`${hdr} di ${p.nome}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
