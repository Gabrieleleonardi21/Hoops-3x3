/** Statistiche di stagione per ogni giocatore aggregate su tutte le tappe della lega corrente. L'aggregazione è quella di
 *  utils/statGiocatori, la stessa della pagina del giocatore: qui si ordina soltanto. */
import { useMemo } from "react";
import { statGiocatori } from "../../utils/statGiocatori";
import type { Tappa } from "../../types";

export function StatsCircuito({ tappe }: { tappe: Tappa[] }) {
  // Per media punti a partita, la più alta in cima. L'array è nuovo: ordinarlo qui non tocca altro
  const rows = useMemo(() => statGiocatori(tappe).sort((a, b) => b.pt / b.g - a.pt / a.g), [tappe]);

  if (rows.length === 0) {
    return (
      <p className="mt-3 text-[15px] text-chalk-muted">
        Nessuna statistica disponibile: registra i punteggi nelle tappe per vedere le classifiche individuali.
      </p>
    );
  }

  const avg = (v: number, g: number) => (g > 0 ? (v / g).toFixed(1) : "—");
  const HEAD: [string, string][] = [["#", "Posizione"], ["Giocatore", "Giocatore"], ["Squadra", "Squadra"], ["G", "Gare"], ["PT", "Punti"], ["Pt/G", "Punti a gara"], ["RB", "Rimbalzi"], ["Rb/G", "Rimbalzi a gara"], ["AS", "Assist"], ["RU", "Rubate"], ["ST", "Stoppate"]];

  return (
    <div className="mt-3 overflow-x-auto rounded border border-asphalt-700">
      <table className="standtable">
        <caption className="sr-only">Statistiche di stagione per giocatore</caption>
        <thead>
          <tr>
            {HEAD.map(([h, title]) => (
              <th key={h} scope="col" title={title} className={h === "Giocatore" || h === "Squadra" ? "text-left" : ""}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.chiave} className={i === 0 ? "bg-court/5" : ""}>
              <td className={`font-display text-base ${i < 3 ? "text-court" : "text-chalk-muted"}`}>{i + 1}</td>
              <td className="tname font-display text-base">{r.nome}</td>
              <td className="text-left text-xs text-chalk-muted">{r.squadra}</td>
              <td className="text-chalk-muted">{r.g}</td>
              <td className="font-display text-lg text-court">{r.pt}</td>
              <td className="font-semibold text-chalk">{avg(r.pt, r.g)}</td>
              <td className="text-chalk-muted">{r.rb}</td>
              <td className="text-chalk-muted">{avg(r.rb, r.g)}</td>
              <td className="text-chalk-muted">{r.as}</td>
              <td className="text-chalk-muted">{r.ru}</td>
              <td className="text-chalk-muted">{r.st}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
