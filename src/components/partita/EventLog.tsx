/** Lista degli eventi di gara in sola lettura (con × per rimuovere se onRemove è fornito) */
import type { EventoGara } from "../../types";
import { INK, RULE } from "../../constants/colors";

interface Props {
  eventi: EventoGara[];
  nameOf: (id: string) => string;
  playerNameById: (pid: string) => string | null;
  onRemove?: (evId: string) => void;
}

export function EventLog({ eventi, nameOf, playerNameById, onRemove }: Props) {
  return (
    <>
      {eventi.map((ev) => (
        <div key={ev.id} className="ui" style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, padding: "4px 0", borderBottom: `1px dotted ${RULE}` }}>
          <strong style={{ minWidth: 86 }}>{ev.tipo}{ev.min ? ` ${ev.min}'` : ""}</strong>
          <span style={{ flex: 1 }}>
            {nameOf(ev.teamId)}{ev.pid ? ` — ${playerNameById(ev.pid) || ""}` : ""}{ev.nota ? ` · ${ev.nota}` : ""}
          </span>
          {onRemove && (
            <button onClick={() => onRemove(ev.id)} className="linkbtn" style={{ color: INK, opacity: 0.5 }}>×</button>
          )}
        </div>
      ))}
    </>
  );
}
