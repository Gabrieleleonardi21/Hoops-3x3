/** Tabella classifica riutilizzabile (gironi, circuito). `<table>` semantica con ordinamento
 *  per colonna (clic sull'intestazione, aria-sort) e riga evidenziata con rail arancio.
 *  L'ordine di default è quello ricevuto (criteri FIBA calcolati in utils/standings). */
import { useMemo, useState } from "react";
import type { StandingRow } from "../../utils/standings";
import { safeUrl } from "../../utils/safeUrl";
import { Icon } from "../ui/Icon";

type SortKey = "rank" | "nome" | "g" | "v" | "p" | "pf" | "ps" | "diff";

const COLS: { key: SortKey; label: string; title: string; num?: boolean }[] = [
  { key: "rank", label: "#", title: "Posizione" },
  { key: "nome", label: "Squadra", title: "Squadra" },
  { key: "g", label: "G", title: "Gare giocate", num: true },
  { key: "v", label: "V", title: "Vinte", num: true },
  { key: "p", label: "P", title: "Perse", num: true },
  { key: "pf", label: "PF", title: "Punti fatti", num: true },
  { key: "ps", label: "PS", title: "Punti subiti", num: true },
  { key: "diff", label: "Diff", title: "Differenza punti", num: true },
];

interface Props {
  rows: StandingRow[];
  logos?: Record<string, string | undefined>; // id squadra → url logo
  highlightId?: string;                        // riga con rail arancio (es. squadra dell'utente)
  caption?: string;                            // testo per screen reader
  compact?: boolean;                           // nasconde PF/PS su schermi stretti
  onRowClick?: (row: StandingRow) => void;
}

export function StandingsTable({ rows, logos, highlightId, caption = "Classifica", compact, onRowClick }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);

  // Rango FIBA fissato sull'ordine in ingresso, così resta corretto anche riordinando per altre colonne
  const ranked = useMemo(() => rows.map((r, i) => ({ ...r, rank: i + 1, diff: r.pf - r.ps })), [rows]);
  const sorted = useMemo(() => {
    if (!sort) return ranked;
    const dir = sort.desc ? -1 : 1;
    return [...ranked].sort((a, b) => {
      if (sort.key === "nome") return a.nome.localeCompare(b.nome) * dir;
      return (a[sort.key] - b[sort.key]) * dir;
    });
  }, [ranked, sort]);

  const toggle = (key: SortKey) => {
    setSort((s) => {
      if (s?.key === key) return s.desc ? null : { key, desc: true };
      // numeriche partono dal più alto, testo dal più basso
      return { key, desc: key !== "nome" && key !== "rank" };
    });
  };

  const hideCls = compact ? " hidden sm:table-cell" : "";

  return (
    <div className="overflow-x-auto rounded border border-asphalt-700">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-9" /><col />
          <col className="w-9" /><col className="w-9" /><col className="w-9" />
          <col className="w-12" /><col className="w-12" /><col className="w-14" />
        </colgroup>
        <thead>
          <tr className="bg-asphalt-900">
            {COLS.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort.desc ? "descending" : "ascending") : "none";
              const align = c.key === "nome" ? "text-left" : "text-center";
              const extra = c.key === "pf" || c.key === "ps" ? hideCls : "";
              return (
                <th key={c.key} scope="col" aria-sort={ariaSort} className={`border-b border-asphalt-600 p-0 ${align}${extra}`}>
                  <button type="button" onClick={() => toggle(c.key)} title={c.title}
                    className={`flex w-full items-center gap-1 px-2 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] hover:text-chalk ${
                      c.key === "nome" ? "justify-start" : "justify-center"} ${active ? "text-court" : "text-chalk-muted"}`}>
                    {c.label}
                    {active && <Icon name="chevron" size={10} className={sort.desc ? "rotate-90" : "-rotate-90"} />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const first = r.rank === 1 && r.g > 0;
            const hl = r.id === highlightId;
            const diffCls = r.diff > 0 ? "text-win" : r.diff < 0 ? "text-loss" : "text-chalk-muted";
            const rowCls = `h-9 border-b border-asphalt-700 last:border-b-0 ${hl ? "bg-court/10 shadow-[inset_3px_0_0_var(--color-court)]" : "hover:bg-asphalt-900"}${
              onRowClick ? " cursor-pointer" : ""}`;
            return (
              <tr key={r.id} className={rowCls} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                <td className={`text-center font-display text-base ${first ? "text-court" : "text-chalk-muted"}`}>{r.rank}</td>
                <td className="px-2 text-left font-semibold text-chalk">
                  <span className="flex items-center gap-2 min-w-0">
                    {logos?.[r.id] && (
                      <img src={safeUrl(logos[r.id]!)} alt="" className="h-5 w-5 shrink-0 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <span className="truncate">{r.nome}</span>
                    {first && <Icon name="trophy" size={12} className="shrink-0 text-gold" />}
                  </span>
                </td>
                <td className="text-center text-chalk-muted">{r.g}</td>
                <td className="text-center font-semibold text-chalk">{r.v}</td>
                <td className="text-center text-chalk-muted">{r.p}</td>
                <td className={`text-center text-chalk-muted${hideCls}`}>{r.pf}</td>
                <td className={`text-center text-chalk-muted${hideCls}`}>{r.ps}</td>
                <td className={`text-center font-semibold ${diffCls}`}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
