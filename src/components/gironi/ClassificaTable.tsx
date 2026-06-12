import type { StandingRow } from "../../utils/standings";
import { INK, ORANGE, RED, PAPER } from "../../constants/colors";

export function ClassificaTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <table className="standtable">
        <thead>
          <tr><th></th><th style={{ textAlign: "left" }}>SQUADRA</th><th>G</th><th>V</th><th>P</th><th>PF</th><th>PS</th><th>DIFF</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={i === 0 && r.g > 0 ? { background: PAPER } : undefined}>
              <td className="disp" style={{ color: i === 0 && r.g > 0 ? ORANGE : INK }}>{i + 1}</td>
              <td className="tname">{r.nome}</td>
              <td>{r.g}</td><td>{r.v}</td><td>{r.p}</td><td>{r.pf}</td><td>{r.ps}</td>
              <td style={{ color: r.pf - r.ps < 0 ? RED : INK }}>{r.pf - r.ps > 0 ? "+" : ""}{r.pf - r.ps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ui" style={{ fontSize: 11, opacity: 0.6, margin: "6px 0 0" }}>
        Ordinamento: vittorie, poi punti fatti, poi differenza punti (criteri FIBA 3x3 semplificati).
      </p>
    </div>
  );
}
