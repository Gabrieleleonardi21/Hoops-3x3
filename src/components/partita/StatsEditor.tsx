import { STAT_KEYS } from "../../constants/rules";
import { RED, RULE } from "../../constants/colors";
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
  return (
    <div style={{ background: "var(--card)", border: `1px solid ${RULE}`, padding: 10 }}>
      <div className="ui" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        Statistiche dei giocatori — {teamName}{guest ? " (facoltative da Ospite)" : " (punti obbligatori, il resto facoltativo)"}
      </div>
      {players.length === 0 && (
        <p className="ui" style={{ fontSize: 12, color: RED, fontWeight: 700, margin: 0 }}>Nessun giocatore nel roster.</p>
      )}
      {players.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="statstable">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>GIOCATORE</th>
                {STAT_KEYS.map(([k, hdr]) => <th key={k}>{hdr}</th>)}
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
