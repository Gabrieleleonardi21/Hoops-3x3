/** Editor del roster di una squadra in una tappa: max 4 giocatori, min 3 per poter sorteggiare. */
import type { GiocatoreRoster } from "../../types";
import { INK } from "../../constants/colors";

interface Props {
  giocatori: GiocatoreRoster[];
  onAdd: () => void;
  onRename: (pid: string, nome: string) => void;
  onRemove: (pid: string) => void;
}

export function RosterEditor({ giocatori, onAdd, onRename, onRemove }: Props) {
  return (
    <>
      {giocatori.map((p, pi) => (
        <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
          <input className="statin" style={{ padding: "6px 8px", fontSize: 13 }}
            placeholder={`Giocatore ${pi + 1}`} value={p.nome}
            onChange={(e) => onRename(p.id, e.target.value)} />
          <button onClick={() => onRemove(p.id)} className="linkbtn"
            style={{ color: INK, opacity: 0.5, fontSize: 16 }} aria-label="Rimuovi giocatore">×</button>
        </div>
      ))}
      {giocatori.length < 4 && (
        <button onClick={onAdd} className="linkbtn" style={{ fontSize: 12 }}>
          + Aggiungi giocatore ({giocatori.length}/4)
        </button>
      )}
    </>
  );
}
