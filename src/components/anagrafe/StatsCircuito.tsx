/** Statistiche di stagione per ogni giocatore aggregate su tutte le tappe della lega corrente. */
import { useMemo } from "react";
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
            <tr key={r.id} className={i === 0 ? "bg-court/5" : ""}>
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
