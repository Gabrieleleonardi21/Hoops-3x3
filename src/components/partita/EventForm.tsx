/** Form per aggiungere un evento di gara: tipo, squadra, giocatore (opzionale), minuto e nota. */
import { useState } from "react";
import { EVENT_TYPES } from "../../constants/eventTypes";
import { Input } from "../ui/Input";
import type { EventoGara, GiocatoreRoster, Partita } from "../../types";

interface Props {
  m: Partita;
  nameOf: (id: string) => string;
  playersOf: (teamId: string) => GiocatoreRoster[];
  onAdd: (ev: Omit<EventoGara, "id">) => void;
}

export function EventForm({ m, nameOf, playersOf, onAdd }: Props) {
  const [draft, setDraft] = useState({ tipo: "Fallo", team: "a" as "a" | "b", pid: "", min: "", nota: "" });
  const lbl = { fontSize: 10.5 };

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

  const selStyle = { marginTop: 3, padding: "6px 8px", fontSize: 12.5 };

  return (
    <div className="row wrap items-end gap-6" style={{ marginTop: 8 }}>
      <label className="ui" style={{ fontSize: 10.5, fontWeight: 700 }}>Tipo
        <select className="statin" style={selStyle} value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}>
          {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="ui" style={{ fontSize: 10.5, fontWeight: 700 }}>Squadra
        <select className="statin" style={selStyle} value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value as "a" | "b", pid: "" })}>
          <option value="a">{nameOf(m.a)}</option>
          <option value="b">{nameOf(m.b)}</option>
        </select>
      </label>
      <label className="ui" style={{ fontSize: 10.5, fontWeight: 700 }}>Giocatore
        <select className="statin" style={selStyle} value={draft.pid} onChange={(e) => setDraft({ ...draft, pid: e.target.value })}>
          <option value="">—</option>
          {playersOf(draft.team === "a" ? m.a : m.b).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <Input label="Minuto" labelStyle={lbl} style={{ padding: "6px 8px", fontSize: 12.5, width: 64 }}
        value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} placeholder="7" />
      <Input label="Nota" labelStyle={{ ...lbl, flex: "1 1 140px" }} style={{ padding: "6px 8px", fontSize: 12.5 }}
        value={draft.nota} onChange={(e) => setDraft({ ...draft, nota: e.target.value })} placeholder="es. esce per falli" />
      <button onClick={add} className="blackbtn" style={{ padding: "8px 12px", fontSize: 12 }}>Aggiungi</button>
    </div>
  );
}
