/** Editor del roster di una squadra in una tappa: al massimo MAX_ROSTER giocatori, almeno MIN_ROSTER per poter sorteggiare (constants/rules). */
import type { GiocatoreRoster } from "../../types";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { MAX_ROSTER } from "../../constants/rules";
import { AVVISO_GIOCATORE_RIPETUTO } from "../../utils/testi";

interface Props {
  giocatori: GiocatoreRoster[];
  onAdd: () => void;
  onRename: (pid: string, nome: string) => void;
  onRemove: (pid: string) => void;
  /** Gli id dei giocatori che si ripetono (doppioniDelRoster): sotto ciascuno compare l'avviso. Facoltativo */
  doppioni?: Set<string>;
}

export function RosterEditor({ giocatori, onAdd, onRename, onRemove, doppioni }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {giocatori.map((p, pi) => (
        <div key={p.id}>
          <div className="flex items-center gap-1.5">
            <input className="statin h-8 py-0 text-[13px]" placeholder={`Giocatore ${pi + 1}`} value={p.nome}
              onChange={(e) => onRename(p.id, e.target.value)} aria-label={`Nome giocatore ${pi + 1}`} />
            <button onClick={() => onRemove(p.id)} className="area-tocco p-1 text-chalk-dim hover:text-loss" aria-label="Rimuovi giocatore">
              <Icon name="close" size={14} />
            </button>
          </div>
          {doppioni?.has(p.id) && <p className="mt-0.5 text-[12px] text-court" role="status">{AVVISO_GIOCATORE_RIPETUTO}</p>}
        </div>
      ))}
      {giocatori.length < MAX_ROSTER && (
        <Button variant="link" className="self-start" onClick={onAdd}>
          <Icon name="plus" size={12} /> Aggiungi giocatore ({giocatori.length}/{MAX_ROSTER})
        </Button>
      )}
    </div>
  );
}
