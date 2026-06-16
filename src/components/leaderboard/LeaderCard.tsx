/** Card con la top 5 di una categoria statistica (punti, rimbalzi, assist…).
 *  Mostra il totale e la media a partita tra parentesi. */
import { INK, ORANGE } from "../../constants/colors";
import type { LeaderRow } from "../../utils/tappaLeaders";
import type { StatLine } from "../../types";

export function LeaderCard({ label, statKey, players }: {
  label: string; statKey: keyof StatLine; players: LeaderRow[];
}) {
  const top = [...players].filter((p) => p[statKey] > 0).sort((a, b) => b[statKey] - a[statKey] || b.pt - a.pt).slice(0, 5);
  if (!top.length) return null;
  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12 }}>
      <div className="disp" style={{ fontSize: 14, textTransform: "uppercase", marginBottom: 8, borderBottom: `2px solid ${INK}`, paddingBottom: 4 }}>
        {label}
      </div>
      {top.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0" }}>
          <span className="disp" style={{ fontSize: 14, minWidth: 18, color: i === 0 ? ORANGE : INK }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ui" style={{ fontSize: 13, fontWeight: 700 }}>{p.nome}</span>
            <span className="ui" style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.6, marginLeft: 6 }}>{p.squadra}</span>
          </span>
          <span className="disp" style={{ fontSize: 16 }}>
            {p[statKey]}
            <span className="ui" style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, marginLeft: 4 }}>
              ({(p[statKey] / p.g).toFixed(1)})
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
