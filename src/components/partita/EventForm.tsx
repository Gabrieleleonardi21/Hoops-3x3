/** Form per aggiungere un evento di gara: tipo, squadra, giocatore (opzionale), minuto e nota. */
import { useState } from "react";
import { EVENT_TYPES } from "../../constants/eventTypes";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { EventoGara, GiocatoreRoster, Partita } from "../../types";

interface Props {
  m: Partita;
  nameOf: (id: string) => string;
  playersOf: (teamId: string) => GiocatoreRoster[];
  onAdd: (ev: Omit<EventoGara, "id">) => void;
}

/* select con lo stesso stile dell'input .statin, compatto */
const SEL = "statin mt-1 h-8 py-0 text-xs";

export function EventForm({ m, nameOf, playersOf, onAdd }: Props) {
  const [draft, setDraft] = useState({ tipo: "Fallo", team: "a" as "a" | "b", pid: "", min: "", nota: "" });

  const add = () => {
    onAdd({
      tipo: draft.tipo,
      teamId: draft.team === "a" ? m.a : m.b,
      pid: draft.pid || null,
      min: draft.min.trim(),
      nota: draft.nota.trim(),
    });
    setDraft({ ...draft, pid: "", min: "", nota: "" });
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-1.5">
      <label className="input-label">Tipo
        <select className={SEL} value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}>
          {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="input-label">Squadra
        <select className={SEL} value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value as "a" | "b", pid: "" })}>
          <option value="a">{nameOf(m.a)}</option>
          <option value="b">{nameOf(m.b)}</option>
        </select>
      </label>
      <label className="input-label">Giocatore
        <select className={SEL} value={draft.pid} onChange={(e) => setDraft({ ...draft, pid: e.target.value })}>
          <option value="">—</option>
          {playersOf(draft.team === "a" ? m.a : m.b).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <Input label="Minuto" className="h-8 py-0 text-xs w-16" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} placeholder="7" />
      <Input label="Nota" labelStyle={{ flex: "1 1 140px" }} className="h-8 py-0 text-xs"
        value={draft.nota} onChange={(e) => setDraft({ ...draft, nota: e.target.value })} placeholder="es. esce per falli" />
      <Button size="sm" variant="outline" onClick={add}>Aggiungi</Button>
    </div>
  );
}
