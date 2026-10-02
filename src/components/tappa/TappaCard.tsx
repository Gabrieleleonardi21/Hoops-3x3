/** Riga cliccabile che mostra il riepilogo di una tappa nella lista della lega */
import type { Tappa } from "../../types";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";

export function TappaCard({ t, onOpen }: { t: Tappa; onOpen: () => void }) {
  const done = t.partite.filter((m) => m.done).length;
  const stato = t.gironi ? `${t.nGironi} gironi · ${done}/${t.partite.length} gare` : "Gironi da sorteggiare";
  return (
    <button className="tapparow group" onClick={onOpen}>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {t.conclusa && <Badge tone="neutral"><Icon name="flag" size={11} /> Conclusa</Badge>}
        <strong className="font-display text-lg text-chalk group-hover:text-court transition-colors">{t.nome}</strong>
        <span className="text-xs text-chalk-muted">
          {[t.luogo, t.data].filter(Boolean).join(" · ")} · {t.squadre.length} squadre
        </span>
      </span>
      <span className={`text-xs font-semibold ${t.gironi ? "text-chalk-muted" : "text-court"}`}>{stato}</span>
    </button>
  );
}
