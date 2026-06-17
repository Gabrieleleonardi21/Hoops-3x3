/** Statistiche di stagione per ogni giocatore aggregate su tutte le tappe della lega corrente. */
import { useMemo } from "react";
import { INK, ORANGE, RULE } from "../../constants/colors";
import type { StatLine, Tappa } from "../../types";

interface PlayerRow {
  id: string;
  nome: string;
  squadra: string;
  g: number;     // partite giocate
  pt: number;
  rb: number;
  as: number;
  ru: number;
  st: number;
}

/** Aggrega le stat di un giocatore da un StatSheet (supporta formato legacy number). */
function extractStat(sheet: Record<string, StatLine | number>, pid: string): StatLine {
  const raw = sheet[pid];
  if (!raw) return {};
  if (typeof raw === "number") return { pt: raw };
  return raw;
}

export function StatsCircuito({ tappe }: { tappe: Tappa[] }) {
  const rows = useMemo<PlayerRow[]>(() => {
    const map = new Map<string, PlayerRow>();

    for (const tappa of tappe) {
      // Indice giocatore id → nome + squadra
      const playerInfo = new Map<string, { nome: string; squadra: string }>();
      for (const sq of tappa.squadre) {
        for (const p of sq.giocatori ?? []) {
          playerInfo.set(p.id, { nome: p.nome, squadra: sq.nome });
        }
      }

      for (const m of tappa.partite) {
        if (!m.done) continue;
        const sheets: Array<[Record<string, StatLine | number>, string]> = [];
        if (m.pa) sheets.push([m.pa as Record<string, StatLine | number>, m.a]);
        if (m.pb) sheets.push([m.pb as Record<string, StatLine | number>, m.b]);

        for (const [sheet] of sheets) {
          for (const pid of Object.keys(sheet)) {
            const info = playerInfo.get(pid);
            if (!info) continue;
            const s = extractStat(sheet, pid);
            const cur = map.get(pid) ?? { id: pid, nome: info.nome, squadra: info.squadra, g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0 };
            map.set(pid, {
              ...cur,
              g:  cur.g  + 1,
              pt: cur.pt + (s.pt ?? 0),
              rb: cur.rb + (s.rb ?? 0),
              as: cur.as + (s.as ?? 0),
              ru: cur.ru + (s.ru ?? 0),
              st: cur.st + (s.st ?? 0),
            });
          }
        }
      }
    }

    return [...map.values()]
      .filter((r) => r.g > 0)
      .sort((a, b) => b.pt / b.g - a.pt / a.g);
  }, [tappe]);

  if (rows.length === 0) {
    return (
      <p style={{ fontStyle: "italic", fontSize: 15, marginTop: 12 }}>
        Nessuna statistica disponibile: registra i punteggi nelle tappe per vedere le classifiche individuali.
      </p>
    );
  }

  const avg = (v: number, g: number) => (g > 0 ? (v / g).toFixed(1) : "—");

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="standtable" style={{ marginTop: 12 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${INK}` }}>
            {["#", "Giocatore", "Squadra", "G", "PT", "Pt/G", "RB", "Rb/G", "AS", "RU", "ST"].map((h) => (
              <th key={h} className="ui" style={{ padding: "5px 8px", fontSize: 11, fontWeight: 700, textAlign: h === "Giocatore" || h === "Squadra" ? "left" : "center" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${RULE}`, background: i === 0 ? "var(--card)" : "transparent" }}>
              <td className="disp" style={{ padding: "5px 8px", fontSize: 13, color: i < 3 ? ORANGE : INK, fontWeight: 700, textAlign: "center" }}>{i + 1}</td>
              <td className="disp" style={{ padding: "5px 8px", fontSize: 13, textTransform: "uppercase" }}>{r.nome}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, opacity: 0.7 }}>{r.squadra}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center" }}>{r.g}</td>
              <td className="disp" style={{ padding: "5px 8px", fontSize: 14, textAlign: "center", color: ORANGE, fontWeight: 700 }}>{r.pt}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center", fontWeight: 700 }}>{avg(r.pt, r.g)}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center" }}>{r.rb}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center" }}>{avg(r.rb, r.g)}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center" }}>{r.as}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center" }}>{r.ru}</td>
              <td className="ui"   style={{ padding: "5px 8px", fontSize: 12, textAlign: "center" }}>{r.st}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
