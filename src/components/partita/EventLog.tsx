/** Lista degli eventi di gara in sola lettura (con × per rimuovere se onRemove è fornito) */
import type { EventoGara } from "../../types";
import { Icon } from "../ui/Icon";

interface Props {
  eventi: EventoGara[];
  nameOf: (id: string) => string;
  playerNameById: (pid: string) => string | null;
  onRemove?: (evId: string) => void;
}

export function EventLog({ eventi, nameOf, playerNameById, onRemove }: Props) {
  if (!eventi.length) return null;
  return (
    <ol className="m-0 list-none p-0">
      {eventi.map((ev) => (
        <li key={ev.id} className="flex items-baseline gap-2 border-b border-asphalt-700/60 py-1.5 text-xs last:border-b-0">
          <span className="w-10 shrink-0 font-display text-sm text-court">{ev.min ? `${ev.min}'` : "—"}</span>
          <span className="shrink-0 font-semibold text-chalk">{ev.tipo}</span>
          <span className="min-w-0 flex-1 truncate text-chalk-muted">
            {nameOf(ev.teamId)}{ev.pid ? ` — ${playerNameById(ev.pid) || ""}` : ""}{ev.nota ? ` · ${ev.nota}` : ""}
          </span>
          {onRemove && (
            <button onClick={() => onRemove(ev.id)} className="area-tocco text-chalk-dim hover:text-loss" aria-label="Rimuovi evento">
              <Icon name="close" size={12} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
